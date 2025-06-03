import jsonfile from 'jsonfile';
import gup from "./src/generateUserMap.js";
import gmp from "./src/generateMilestoneMap.js";
import fetchFromJira from "./src/fetchFromJira.js";
import * as import2github from "./src/importToGithub.js";
import * as getAttachments from "./src/getAttachments.js";

export const generateUserMap = async function (fileName, output, dryRun = false) {
    let exportData;
    try {
        exportData = await jsonfile.readFile(fileName);
    } catch (err) {
        throw err;
    }

    let userMap = gup(exportData);

    if (dryRun) {
        console.log(JSON.stringify(userMap, null, 2));
    } else {
        jsonfile.writeFileSync(output, userMap, {spaces: 2});
    }
};

export const generateMilestoneMap = async function (fileName, output, dryRun = false, semver=true) {
    let exportData;
    try {
        exportData = await jsonfile.readFile(fileName);
    } catch (err) {
        throw err;
    }

    let milestoneMap = gmp(exportData, semver);

    if (dryRun) {
        console.log(JSON.stringify(milestoneMap, null, 2));
    } else {
        jsonfile.writeFileSync(output, milestoneMap, {spaces: 2});
    }
};

export const fetchAttachments = async function (fileName, output, dryRun = false, options = {}) {
    let result;

    try {
        let exportData = await jsonfile.readFile(fileName);
        result = await getAttachments.getAttachments(exportData, {outputPath: output, dryRun: dryRun, ...options});
    } catch (err) {
        throw err;
    }

    if (dryRun) {
        console.log(JSON.stringify(result, null, 2));
    }
};

export const fetchIssues = async function (url = "https://fluidproject.atlassian.net/rest/api/3/search/jql", params = `{"jql":"project = FLUID AND resolution = Migrated ORDER BY created ASC","fields":"*all"}`, output = "./issues.json") {

    const issues = await fetchFromJira(url, JSON.parse(params));

    jsonfile.writeFileSync(output, issues, {spaces: 2});
};

/*
    expected options are:
    - owner
    - repo
    - (token or appId, privateKey, installationId)
    - includeKeyInTitle
    - issueBaseUrl
    - attachmentBaseUrl
*/
export const importIssues = async function (fileName, output, userMapFileName, milestoneMapFileName, dryRun = false, options) {
    const opts = {
        ...options,
        dryRun: dryRun
    }

    let exportData;

    try {
        exportData = fileName ? await jsonfile.readFile(fileName) : fetchFromJira(opts.url, opts.params);
    } catch (err) {
        throw err;
    }

    console.log(milestoneMapFileName);

    const userMap = userMapFileName ? await jsonfile.readFile(userMapFileName) : gup(exportData);
    const milestoneMap = milestoneMapFileName ? await jsonfile.readFile(milestoneMapFileName) : gmp(exportData);

    const data = await import2github.submitIssue(exportData, userMap, milestoneMap, opts);

    jsonfile.writeFileSync(output, data, {spaces: 2});
}

// export const getIssueTypes = async function (fileName, output) {
//     let exportData;

//     try {
//         exportData = fileName ? await jsonfile.readFile(fileName) : fetchFromJira(opts.url, opts.params);
//     } catch (err) {
//         throw err;
//     }

//     let data = exportData.reduce((accumulator, current) => {
//         let issueType = current.fields.issuetype.name;

//         if (!accumulator.includes(issueType)) {
//             accumulator.push(issueType);
//         }

//         return accumulator;
//     }, []);

//     jsonfile.writeFileSync(output, data, {spaces: 2});
// };

// export const getLabels = async function (fileName, output) {
//     let exportData;

//     try {
//         exportData = fileName ? await jsonfile.readFile(fileName) : fetchFromJira(opts.url, opts.params);
//     } catch (err) {
//         throw err;
//     }

//     let data = exportData.reduce((accumulator, current) => [...new Set([...accumulator, ...current.fields.labels])], []);

//     jsonfile.writeFileSync(output, data, {spaces: 2});
// };

// export const getStatuses = async function (fileName, output) {
//     let exportData;

//     try {
//         exportData = fileName ? await jsonfile.readFile(fileName) : fetchFromJira(opts.url, opts.params);
//     } catch (err) {
//         throw err;
//     }

//     let data = exportData.reduce((accumulator, current) => {
//         let status = `${current.fields.statusCategory?.name} - ${current.fields.resolution?.name}`;

//         if (!accumulator.includes(status)) {
//             accumulator.push(status);
//         }

//         return accumulator;
//     }, []);

//     jsonfile.writeFileSync(output, data, {spaces: 2});
// };

export const getKeys = async function (fileName, output) {
    let exportData;

    try {
        exportData = fileName ? await jsonfile.readFile(fileName) : fetchFromJira(opts.url, opts.params);
    } catch (err) {
        throw err;
    }

    let data = exportData.map(issue => issue.key);

    jsonfile.writeFileSync(output, data, {spaces: 2});
};
