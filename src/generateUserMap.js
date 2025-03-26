let updateUserMap = function (userMap, jira_user_id, name, link, type) {
    let found = userMap[jira_user_id];

    if (!found) {
        userMap[jira_user_id] = {
            name: name,
            link: link,
            type: type,
            github: ""
        }
    }

    if (found?.type === "comment" && type !== "comment") {
        userMap[jira_user_id].name = name;
        userMap[jira_user_id].link = link;
        userMap[jira_user_id].type = type;
    }
};

export default function generateUserMap(jiraExportData) {
    let userMap = {};

    jiraExportData.rss.channel.item.forEach(issue => {
        let link = issue.link;
        let assignee_id = issue.assignee["@_accountid"];
        let assignee_name = issue.assignee["#text"];
        let reporter_id = issue.reporter["@_accountid"];
        let reporter_name = issue.reporter["#text"];

        if (assignee_id !== -1) {
            updateUserMap(userMap, assignee_id, assignee_name, link, "assignee");
        }

        if (reporter_id !== -1) {
            updateUserMap(userMap, reporter_id, reporter_name, link, "reporter");
        }

        if (issue.comments) {
            if (Array.isArray(issue.comments.comment)) {
                issue.comments.comment.forEach(comment => {
                    updateUserMap(userMap, comment["@_author"], "", `${link}\?focusedCommentId\=${comment["@_id"]}`, "comment");
                });
            } else {
                updateUserMap(userMap, issue.comments.comment["@_author"], "", `${link}\?focusedCommentId\=${issue.comments.comment["@_id"]}`, "comment");
            }
        }
    });

    return userMap;
};
