import jsonfile from 'jsonfile';
import {XMLParser} from 'fast-xml-parser';
import {readFile} from 'node:fs/promises';

import gup from "./src/generateUserMap.js";
import fetchFromJira from "./src/fetchFromJira.js";
import * as import2github from "./src/importToGithub.js";
import * as getAttachments from "./src/getAttachments.js";

export const getXMLExportData = async function (fileName) {
    const parser = new XMLParser({
        removeNSPrefix: true,
        ignoreAttributes: false,
        parseTagValue: true,
        parseAttributeValue: true,
    });

    let XMLdata;
    let exportData;

    try {
        XMLdata = await readFile(fileName, {encoding: 'utf8'});
    } catch (err) {
        throw err;
    }

    try {
        exportData = parser.parse(XMLdata, true);
    } catch (err) {
        throw err;
    }

    return exportData;
};

export const exportDataToJson = async function (fileName, output, dryRun = false) {
    let exportData = await getXMLExportData(fileName);

    if (dryRun) {
        console.log(JSON.stringify(exportData, null, 2));
    } else {
        jsonfile.writeFileSync(output, exportData, {spaces: 2});
    }
};

export const generateUserMap = async function (fileName, output, isJSON = false, dryRun = false) {
    let exportData;
    try {
        exportData = isJSON ? await jsonfile.readFile(fileName) : await getXMLExportData(fileName);
    } catch (err) {
        throw err;
    }

    if (dryRun) {
        console.log(JSON.stringify(gup(exportData), null, 2));
    } else {
        jsonfile.writeFileSync(output, gup(exportData), {spaces: 2});
    }
};

export const fetchAttachments = async function (fileName, output, isJSON = false, dryRun = false, options = {}) {
    let exportData;

    try {
        exportData = isJSON ? await jsonfile.readFile(fileName) : await getXMLExportData(fileName);
    } catch (err) {
        throw err;
    }

    let result = await getAttachments.getAttachments(exportData, {output: output, dryRun: dryRun, ...options});

    if (dryRun) {
        console.log(JSON.stringify(result, null, 2));
    }
};

/*
    expected options are:  owner, repo, titleType, (token or appId, privateKey, installationId)
*/
export const importIssues = async function (fileName, output, userMapFileName, isJSON = false, dryRun = false, options) {
    let opts = {
        ...options,
        dryRun: dryRun
    }

    let exportData;

    try {
        exportData = isJSON ? await jsonfile.readFile(fileName) : await getXMLExportData(fileName);
    } catch (err) {
        throw err;
    }

    let userMap = userMapFileName ? await jsonfile.readFile(userMapFileName) : gup(exportData);

    let data = await import2github.submitIssue(exportData, userMap, opts);

    if (dryRun) {
        let numComments = data.issues.reduce((accumulator, issue) => accumulator + issue.comments.length, 0);
        console.log(`issues: ${data.issues.length}\ncomments: ${numComments}\ntotal requests: ${data.issues.length + numComments}`);
    }

    jsonfile.writeFileSync(output, data, {spaces: 2});
}

export const fetchIssues = async function (url = "https://fluidproject.atlassian.net/rest/api/3/search/jql", params = `{"jql":"created < now() order by created ASC","fields":"*all"}`, output = "./issues.json") {

    const issues = await fetchFromJira(url, JSON.parse(params));

    jsonfile.writeFileSync(output, issues, {spaces: 2});
};
