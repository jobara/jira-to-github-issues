let updateUserMap = function (userMap, data) {
    if (!data) {
        return;
    }

    let found = userMap[data.accountId];

    if (!found) {
        userMap[data.accountId] = {
            name: data.displayName,
            link: data.self,
            github: ""
        }
    }
};

export default function generateUserMap(jiraIssues) {
    let userMap = {};

    jiraIssues.forEach(issue => {

        updateUserMap(userMap, issue.fields.assignee);
        updateUserMap(userMap, issue.fields.creator);
        updateUserMap(userMap, issue.fields.reporter);

        issue.fields.comment.comments.forEach(comment => {
            updateUserMap(userMap, comment.author);
            updateUserMap(userMap, comment.updateAuthor);
        })
    });

    return userMap;
};
