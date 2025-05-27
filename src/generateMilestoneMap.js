import {sort, coerce, valid} from "semver";

let getMilestones = function (data, semver) {
    return data.map(item => {
        return semver ? valid(coerce(item.name.replace("beta", "-beta."), {includePrerelease: true})) : item.name;
    });
};

export default function generateMilestoneMap(jiraIssues, semver) {
    let milestones = jiraIssues.reduce((accumulator, issue) => {
        return [...new Set([...accumulator, ...getMilestones(issue.fields.versions, semver), ...getMilestones(issue.fields.fixVersions, semver)])];

    }, []);

    let sorted = semver ? sort(milestones) : milestones.sort();
    let entries = sorted.map(milestone => [milestone, ""]);

    return Object.fromEntries(entries);
};
