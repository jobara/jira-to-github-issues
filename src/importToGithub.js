import {createAppAuth} from "@octokit/auth-app";
import {Octokit} from "@octokit/core";
import Bottleneck from "bottleneck";
import {rsort, clean, coerce, valid} from "semver";
import logger from './logger.js';

const typeMap = {
    "Bug": "Bug",
    "Sub-issue": "Bug",
    "Task": "Task",
    "Sub-task": "Task",
    "Improvement": "Feature",
    "New Feature": "Feature",
    "Technical task": "Task",
    "Epic": "Feature",
    "Story": "Feature",
    "Source": "",
    "Design": "Feature"
};

const typeToLabelMap = {
    "Bug": "bug",
    "Sub-issue": "bug",
    "Task": "enhancement",
    "Sub-task": "enhancement",
    "Improvement": "enhancement",
    "New Feature": "enhancement",
    "Technical task": "enhancement",
    "Epic": "enhancement",
    "Story": "enhancement",
    "Source": "",
    "Design": "design"
};

export const jiraIdToGhMention = function (jiraId, userMap) {
    if (!userMap[jiraId]) {
        return "unknown";
    }

    return userMap[jiraId].github ? `@${userMap[jiraId].github}` : userMap[jiraId].name;
};

export const sortedUsers = function (userMap) {
    let users = Object.values(userMap);

    return users.sort((a, b) => {
        let diff = b.name.length - a.name.length;

        if (diff === 0) {
            diff = b.name >= a.name ? -1 : 1;
        }

        return diff;
    });;
};

export const replaceMentions = function (content, users) {
    let replaced = content;

    users.forEach(user => {
        let regex = new RegExp(`@@${user.name}`, "g");
        replaced = replaced.replace(regex, user.github ? `@${user.github}` : user.name);
    });

    return replaced;
};

export const toGhState = function (state) {
    return state === "Done" ? "closed" : "open";
};

export const toGhStateReason = function (resolution) {
    let completedResolutions = ["Done", "Fixed", "Incomplete"];

    if (completedResolutions.includes(resolution)) {
        return "completed";
    }

    return "not_planned";
};

export const getIssueUrl = function (issue, issueBaseUrl) {
    let url = new URL(issueBaseUrl || issue.self);
    url.pathname = `browse/${issue.key}/`;

    return url;
};

export const compileDescription = function (issue, userMap, users, options = {}) {
    let url = getIssueUrl(issue, options.issueBaseUrl);
    let description = issue.fields.description ? replaceMentions(issue.fields.description, users) : "";

    if (issue.component) {
        let components = issue.fields.components.map(component => component.name);
        description += `\n\n## Components\n\n- ${components.join("\n- ")}`;
    }

    if (issue.environment) {
        description += `\n\n## Details\n\n${issue.fields.environment}`;
    }

    let createdOn = new Date(issue.fields.created);
    description += `\n\n## Additional context or notes\n\n`;
    description += `Originally filed as [${issue.key}](${url}) by ${jiraIdToGhMention(issue.fields.creator.accountId, userMap)} on ${createdOn.toLocaleString("en-CA", {month: 'long', year: 'numeric', day: 'numeric'})}.`

    if (issue.fields.attachment?.length) {
        let attachments = issue.fields.attachment.map(attachment => {
            let attachmentUrl = new URL(options.attachmentBaseUrl);
            attachmentUrl.pathname = `${attachmentUrl.pathname}/${issue.fields.project.key}/${issue.key}/${attachment.filename}`;
            return `[${attachment.filename}](${attachmentUrl.toString()})`;
        });

        description += `\n\n### Attachments\n\n- ${attachments.join("\n- ")}`;
    }

    if (issue.fields.subtasks.length) {
        let subtasks = issue.fields.subtasks.map(subtask => {
            let subtaskUrl = getIssueUrl(subtask, options.issueBaseUrl);
            return `[${subtask.key}: ${subtask.fields.summary}](${subtaskUrl})`;
        });

        description += `\n\n### Subtasks\n\n- ${subtasks.join("\n- ")}`;
    }

    if (issue.fields.parent) {
        let parentUrl = getIssueUrl(issue.fields.parent, options.issueBaseUrl);
        description += `\n\n### Parent\n\n[${issue.fields.parent.key}: ${issue.fields.parent.fields.summary}](${parentUrl})`;
    }

    if (issue.fields.issuelinks.length) {
        description += "\n\n### Linked issues\n\n";

        let issuelinks = issue.fields.issuelinks.map(issuelink => {
            if (issuelink.outwardIssue) {
                let outwardUrl = getIssueUrl(issuelink.outwardIssue, options.issueBaseUrl);
                return `${issuelink.type.outward} [${issuelink.outwardIssue.key}: ${issuelink.outwardIssue.fields.summary}](${outwardUrl})`;
            }

            if (issuelink.inwardIssue) {
                let inwardUrl = getIssueUrl(issuelink.inwardIssue, options.issueBaseUrl);
                return `${issuelink.type.inward} [${issuelink.inwardIssue.key}: ${issuelink.inwardIssue.fields.summary}](${inwardUrl})`;
            }
        });

        description += `\n- ${issuelinks.join("\n- ")}`;
    }

    return description;
};

export const compileLabels = function (issueType, labels) {
    let newLabels = [];

    const typeLabel = typeToLabelMap[issueType];

    if (typeLabel) {
        newLabels.push(typeLabel);
    }

    if (labels.includes("accessibility")) {
        newLabels.push("accessibility");
    }

    return newLabels;
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

export const compileIssues = function (issues, userMap, milestoneMap, options = {}) {
    let opts = {
        includeKeyInTitle: true,
        ...options
    };

    let users = sortedUsers(userMap);

    return issues.map( issue => {
        let url = getIssueUrl(issue, opts.issueBaseUrl);

        let issueData = {
            title: opts.includeKeyInTitle ? `[${issue.key}] ${issue.fields.summary}` : issue.fields.summary,
            type: typeMap[issue.fields.issuetype.name],
            body: compileDescription(issue, userMap, users, opts),
            comments: [],
            status: {
                state: toGhState(issue.fields.statusCategory.name)
            },
            jira: {
                key: issue.key,
                link: url.toString()
            }
        };

        if (issue.fields.resolution) {
            issueData.status["state_reason"] = toGhStateReason(issue.fields.resolution.name);
        }

        let labels = compileLabels(issue.fields.issuetype.name, issue.fields.labels);

        if (labels.length) {
            issueData["labels"] = labels;
        }

        if (issue.fields.fixVersions.length) {
            let milestone = issue.fields.fixVersions.length === 1 ? valid(coerce(issue.fields.fixVersions[0].name.replace("beta", "-beta."), {includePrerelease: true})) : rsort(issue.fields.fixVersions.map(fixVersion => valid(coerce(fixVersion.name.replace("beta", "-beta."), {includePrerelease: true}))))[0];
            issueData["milestone"] = milestoneMap[milestone] || undefined;
        }

        if (issue.fields.comment.comments.length) {
            issueData.comments = issue.fields.comment.comments.map((comment) => {
                let commentURL = new URL(url.toString());
                commentURL.hash = `comment-${comment.id}`;
                commentURL.searchParams.set("focusedCommentId", comment.id);

                let commentedOn = new Date(comment.created);
                let preamble = `Comment migrated from [${issue.key}](${commentURL.toString()}). Originally posted by ${jiraIdToGhMention(comment.author.accountId, userMap)} on ${commentedOn.toLocaleString("en-CA", {month: 'long', year: 'numeric', day: 'numeric'})}.`;
                let content = replaceMentions(comment.body, users);

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
    let commentsLogger = logger.child({'github-id': issueNum, 'comments_count': comments.length});

    commentsLogger.info('Begin importing comments');

    for (const comment of comments) {
        let commentLogger = commentsLogger.child({'comment': comment.body});

        commentLogger.info('Request to create GitHub issue comment');
        try {
            await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
                owner: options.owner,
                repo: options.repo,
                issue_number: issueNum,
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                },
                ...comment
            });
        } catch (error) {
            commentLogger.fatal(error, 'Failed creating comment');
            throw(error);
        }

        commentLogger.info('GitHub issue comment created');
    }

    commentsLogger.info('Importing comments complete');
};

export const updateIssue = async function (issueNum, data, options) {
    let octokit = options.octokit || authenticate(options);
    let updateLogger = logger.child({'github-id': issueNum, 'data': {...data}});

    updateLogger.info('Begin updating GitHub issue');
    try {
        await octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
            owner: options.owner,
            repo: options.repo,
            issue_number: issueNum,
            headers: {
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            },
            ...data
        });
    } catch (error) {
        updateLogger.fatal(error, 'Failed updating GitHub issue');
        throw(error);
    }

    updateLogger.info('Updating GitHub issue complete');
};

export const postIssues = async function (issues, limiter, options) {
    logger.info('Begin importing issues to GitHub');

    let octokit = options.octokit || authenticate(options);
    let summary = {};

    for (const issue of issues) {
        const {comments, jira, status, ...issueData} = issue;

        let issueLogger = logger.child({'jira-key': jira.key, 'jira-state': status.state});

        try {
            issueLogger.info('request to create GitHub issue');
            let response = await limiter.schedule(() => octokit.request('POST /repos/{owner}/{repo}/issues', {
                owner: options.owner,
                repo: options.repo,
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                },
                ...issueData
            }));

            let createdIssueLogger = issueLogger.child({'github-id': response.data.number})
            createdIssueLogger.info('GitHub issue created');

            summary[jira.key] = {
                jira: jira.link,
                github: response.url,
                number: response.data.number
            }

            await limiter.schedule(() => postComments(response.data.number, comments, {
                'octokit': octokit,
                ...options
            }));

            if (status.state === "closed") {
                createdIssueLogger.info('request to close GitHub issue')
                await limiter.schedule(() => updateIssue(response.data.number, status, {
                    'octokit': octokit,
                    ...options
                }));
                createdIssueLogger.info('GitHub issue closed')
            }
        } catch (error) {
            issueLogger.fatal(error, 'Failed creating issue');
            throw(error);
        }
    };

    logger.info('Importing issues to GitHub complete');
    return summary;
};

export const submitIssue = async function (exportData, userMap, milestoneMap, options) {
    let opts = {
        dryRun: false,
        includeKeyInTitle: true,
        exclude: [],
        include: [],
        ...options
    }

    // logger.info({
    //     'dry-run': opts.dryRun,
    //     'exclude': opts.exclude || [],
    //     'include': opts.include || []
    // }, 'Begin JIRA to GitHub issues import');

    // let filterLogger = logger.child({
    //     'exclude': opts.exclude || [],
    //     'include': opts.include || []
    // })

    // filterLogger.info('JIRA issues to filter');

    let filtered = opts.exclude.length || opts.include.length ? exportData.filter(issue => {
        if (opts.include.length) {
            return opts.include.includes(issue.key) && !opts.exclude.includes(issue.key);
        }

        return !opts.exclude.includes(issue.key);

    }) : exportData;

    logger.info({
        'dry-run': opts.dryRun,
        'exclude': opts.exclude || [],
        'include': opts.include || [],
        'total-issues': exportData.length,
        'filtered-issues': filtered.length
    }, 'Begin JIRA to GitHub issues import');

    let issues = compileIssues(filtered, userMap, milestoneMap, opts);

    if (opts.dryRun) {
        const numComments = issues.reduce((accumulator, issue) => accumulator + issue.comments.length, 0);
        const numClosedIssues = issues.reduce((accumulator, issue) => issue.status.state === "closed" ? ++accumulator : accumulator, 0);

        logger.info({
            'dry-run': opts.dryRun,
            'issues-to-create': issues.length,
            'issues-to-close': numClosedIssues,
            'comments-to-create': numComments,
            'total-requests': issues.length + numClosedIssues + numComments

        }, 'Dry Run: Completed JIRA to GitHub issues import');

        return {issues: issues};
    }

    let limiter = new Bottleneck({
        reservoir: 500,
        reservoirRefreshAmount: 500,
        reservoirRefreshInterval: 60 * 60 * 1000,
        maxConcurrent: 1,
        minTime: 750
    });

    return await postIssues(issues, limiter, opts);
};
