import Bottleneck from "bottleneck";
import {fromADF} from "mdast-util-from-adf";
import {toMarkdown} from "mdast-util-to-markdown";
import {gfmToMarkdown} from "mdast-util-gfm";
import logger from './logger.js';

export const adfToMd = function (adf) {
    return toMarkdown(fromADF(adf), {extensions: [gfmToMarkdown()]});
};

export const replaceAdfWithMd = function (issue) {
    let converted = {...issue};

    if (converted.fields?.description) {
        converted.fields.description = adfToMd(converted.fields.description);
    }

    if (converted.fields?.environment) {
        converted.fields.environment = adfToMd(converted.fields.environment);
    }

    if (converted.fields?.comment?.comments?.length) {
        converted.fields.comment.comments = converted.fields.comment.comments.map(comment => {
            return {...comment, body: adfToMd(comment.body)}
        });
    }

    return converted;
};

export const fetchIssues = async function (url, params, limiter) {
    let data = {};

    const query = new URLSearchParams(params);

    limiter = limiter || new Bottleneck({
        reservoir: 500,
        reservoirRefreshAmount: 500,
        reservoirRefreshInterval: 5 * 60 * 1000,
        maxConcurrent: 1,
        minTime: 100
    });

    fetchLogger = logger.child({'query': `Loading page ${url}?${query}`});
    try {
        fetchLogger.info('Fetch from JIRA API');
        const response = await limiter.schedule(() => fetch(`${url}?${query}`, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "X-Force-Accept-Language": true,
                "Accept-Language": "en"
            }
        }));

        if (!response.status === "200") {
            throw new Error(`${response.status}: ${response.statusText}`);
        }

        data = await response.json();

    } catch (error) {
        fetchLogger.fail(error, 'Fetch failed');
        throw error;
    }

    let issues = data.issues.map(replaceAdfWithMd);

    if (data.nextPageToken) {
        params["nextPageToken"] = data.nextPageToken;
        let nextIssues = await fetchIssues(url, params, limiter);

        return issues.concat(nextIssues);
    }

    return issues;
}

export default async function (url, params) {
    return fetchIssues(url, params);
}
