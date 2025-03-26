import TurndownService from 'turndown';
import {createAppAuth} from "@octokit/auth-app";
import {Octokit} from "@octokit/core";

const turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced"
});

const typeMap = {
    "Task": "Task",
    "Sub-task": "Task",
    "New Feature": "Feature",
    "Improvement": "Feature",
    "Design": "Feature",
    "Bug": "Bug"
};

export const makeArray = function (item) {
    return Array.isArray(item) ? item : [item];
};

export const convertJiraId = function (jiraId, userMap) {
    if (!userMap[jiraId]) {
        return "";
    }

    return userMap[jiraId].github ? `@${userMap[jiraId].github}` : userMap[jiraId].name;
};

export const compileDescription = function (issue, userMap) {
    let description = turndownService.turndown(issue.description);

    if (issue.component) {
        let components = makeArray(issue.component);
        description += `\n\n## Components\n\n- ${components.join("\n- ")}`;
    }

    if (issue.environment) {
        description += `\n\n## Details\n\n${turndownService.turndown(issue.environment)}`;
    }

    let createdOn = new Date(issue.created);
    description += `\n\n## Additional context or notes\n\n`;
    description += `Originally filed as [${issue.key["#text"]}](${issue.link}) by ${convertJiraId(issue.reporter["@_accountid"], userMap)} on ${createdOn.toLocaleString("en-CA", {month: 'long', year: 'numeric', day: 'numeric'})}.`

    if (issue.attachments) {
        let attachments = makeArray(issue.attachments.attachment);

        description += `\n\n### Attachments\n\n- ${attachments.map((attachment) => attachment["@_name"]).join("\n- ")}`;
    }

    if (issue.subtasks) {
        let subtasks = makeArray(issue.subtasks.subtask);

        description += `\n\n### Subtasks\n\n- ${subtasks.map((subtask) => `[${subtask["#text"]}](${issue.link.replace(issue.key["#text"], subtask["#text"])})`).join("\n- ")}`;
    }

    if (issue.parent) {
        description += `\n\n### Parent\n\n[${issue.parent["#text"]}](${issue.link.replace(issue.key["#text"], issue.parent["#text"])})`;
    }

    if (issue.issuelinks) {
        let issuelinkTypes = makeArray(issue.issuelinks.issuelinktype);

        description += "\n\n### Linked issues\n\n";

        let accumulatedLinks = {};

        issuelinkTypes.forEach((issuelinkType) => {
            if (issuelinkType.outwardlinks) {
                let relation = issuelinkType.outwardlinks["@_description"];
                accumulatedLinks[relation] = accumulatedLinks[relation] || [];

                makeArray(issuelinkType.outwardlinks.issuelink).forEach((issuelink) => {
                    accumulatedLinks[relation].push(issuelink.issuekey["#text"]);
                });
            }

            if (issuelinkType.inwardlinks) {
                let relation = issuelinkType.inwardlinks["@_description"];
                accumulatedLinks[relation] = accumulatedLinks[relation] || [];

                makeArray(issuelinkType.inwardlinks.issuelink).forEach((issuelink) => {
                    accumulatedLinks[relation].push(issuelink.issuekey["#text"]);
                });
            }
        });

        for (const [relation, linkedIssues] of Object.entries(accumulatedLinks)) {
            description += `\n- ${relation}\n  - ${linkedIssues.map((linkedIssue) => `[${linkedIssue}](${issue.link.replace(issue.key["#text"], linkedIssue)})`).join("\n  - ")}`;
        }
    }

    return description;
};

export const compileLabels = function (issue) {
    let labels = [];

    if (issue.type["#text"] === "Design") {
        labels.push("design");
    }

    if (issue.type["#text"] === "Bug") {
        labels.push("bug");
    }

    if (issue.type["#text"] === "Sub-issue") {
        labels.push("bug");
    }

    if (issue.type["#text"] === "Task") {
        labels.push("enhancement");
    }

    if (issue.type["#text"] === "Sub-task") {
        labels.push("enhancement");
    }

    if (issue.type["#text"] === "New Feature") {
        labels.push("enhancement");
    }

    if (issue.type["#text"] === "Improvement") {
        labels.push("enhancement");
    }

    if (
        issue.labels &&
        (
            issue.labels.label === "accessibility" ||
            (
                Array.isArray(issue.labels.label) &&
                issue.labels.label.includes("accessibility")
            )
        )
    ) {

        labels.push("accessibility");
    }

    return labels.length ? labels : null;
};

export const authenticate = function (options) {
    let opts = {};

    if (options.token) {
        opts = {auth: options.token};
    } else {
        opts = {
            authStrategy: createAppAuth,
            auth: {
                appId: options.appId,
                privateKey: options.privateKey,
                installationId: options.installationId,
            }
        }
    }

    return new Octokit(opts);
};

export const compileIssues = function (issues, userMap, titleType="title") {
    return makeArray(issues).map( (issue) => {
        let issueData = {
            title: titleType === "summary" ? issue.summary : issue.title,
            type: typeMap[issue.type["#text"]] ?? "Bug",
            body: compileDescription(issue, userMap),
            comments: [],
            jira: {
                key: issue.key["#text"],
                link: issue.link
            }
        };

        let labels = compileLabels(issue);

        if (labels) {
            issueData["labels"] = labels;
        }

        if (issue.fixVersion) {
            issueData["milestone"] = issue.fixVersion;
        }

        if (issue.comments) {
            issueData.comments = makeArray(issue.comments.comment).map((comment) => {
                let commentedOn = new Date(comment["@_created"]);
                let preamble = `Comment migrated from [${issue.key["#text"]}](${issue.link}?focusedCommentId=${comment["@_id"]}). Originally posted by ${convertJiraId(comment["@_author"], userMap)} on ${commentedOn.toLocaleString("en-CA", {month: 'long', year: 'numeric', day: 'numeric'})}.`;
                let content = turndownService.turndown(comment["#text"]);

                return {
                    body: `${preamble}\n\n${content}`
                };
            });
        }

        return issueData;
    });
};

export const postComments = async function (issueNum, comments, options) {
    let octokit = options.octokit || authenticate(options);

    return Promise.all(makeArray(comments).map(async (comment) => {
        return octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
            owner: options.owner,
            repo: options.repo,
            issue_number: issueNum,
            headers: {
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            },
            ...comment
        })
    }));
};

export const postIssues = async function (issues, options) {
    let octokit = options.octokit || authenticate(options);

    let summary = {};

    await Promise.all(makeArray(issues).map(async (issue) => {
        const {comments, jira, ...issueData} = issue;

        try {
            let response = await octokit.request('POST /repos/{owner}/{repo}/issues', {
                owner: options.owner,
                repo: options.repo,
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                },
                ...issueData
            })

            summary[jira.key] = {
                jira: jira.link,
                github: response.url,
                number: response.data.number
            }

            await postComments(response.data.number, comments, {
                'octokit': octokit,
                ...options
            });
        } catch (error) {
            throw(error);
        }
    }));

    return summary;
};

export const submitIssue = async function (exportData, userMap, options) {
    let opts = {
        dryRun: false,
        titleType: "title",
        ...options
    }

    let issues = compileIssues(exportData.rss.channel.item, userMap, opts.titleType);

    if (opts.dryRun) {
        return {issues: issues};
    }

    return await postIssues(issues, opts);
};
