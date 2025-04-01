import url from 'node:url';
import path from 'node:path';
import {createWriteStream} from "node:fs";
import {mkdir} from "node:fs/promises";
import {Readable} from "node:stream";
import {pipeline} from "node:stream/promises";
import * as utils from "./utils.js";

import Bottleneck from "bottleneck";

export const compileAttachments = function (issues, options) {
    let attachments = [];

    utils.makeArray(issues).forEach(issue => {
        let issueURL = new URL(issue.link);

        let project = issue.project["@_key"];
        let key = issue.key["#text"];

        utils.makeArray(issue.attachments.attachment).forEach(attachment => {
            if (attachment) {
                issueURL.pathname = `/rest/api/3/attachment/content/${attachment["@_id"]}`;

                attachments.push({
                    source: issueURL.href,
                    destination: path.join(options?.output ?? "./", project, key, attachment["@_name"])
                });
            }
        });
    });

    return attachments;
};

export const retrieveAttachment = async function (attachment, options) {
    const resp = await fetch(attachment.source);

    await mkdir(path.dirname(attachment.destination), {recursive: true});

    return await pipeline(
        Readable.fromWeb(resp.body),
        createWriteStream(attachment.destination)
    );
};

export const retrieveAttachments = async function (attachments, options) {
    const limiter = new Bottleneck({
        reservoir: 500,
        reservoirRefreshAmount: 500,
        reservoirRefreshInterval: 5 * 60 * 1000,
        maxConcurrent: 1,
        minTime: 200
    });

    for (const attachment of attachments) {
        await limiter.schedule(() => retrieveAttachment(attachment, options));
    }
};

export const getAttachments = async function (jiraExportData, options) {
    let opts = {
        output: "./",
        dryRun: false,
        ...options
    }

    let attachments = compileAttachments(jiraExportData.rss.channel.item, options);

    if (opts.dryRun) {
        return {attachments: attachments};
    }

    return await retrieveAttachments(attachments, opts);
};
