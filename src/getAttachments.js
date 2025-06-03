import path from 'node:path';
import {createWriteStream} from "node:fs";
import {mkdir} from "node:fs/promises";
import {Readable} from "node:stream";
import {pipeline} from "node:stream/promises";
import logger from './logger.js';

import Bottleneck from "bottleneck";

export const compileAttachments = function (issues, outputPath = "./") {
    let attachments = [];

    issues.forEach(issue => {
        let issueURL = new URL(issue.self);
        issueURL.pathname = `browse/${issue.key}/`;

        let project = issue.fields.project.key;

        (issue.fields.attachment ?? []).forEach(attachment => {
            attachments.push({
                source: attachment.content,
                destination: path.join(outputPath, project, issue.key, attachment.filename),
                size: attachment.size,
                mimeType: attachment.mimeType
            });
        });
    });

    return attachments;
};

export const retrieveAttachment = async function (attachment) {
    let attachmentLogger = logger.child(attachment);

    attachmentLogger.info("Fetch attachment");
    const resp = await fetch(attachment.source);
    attachmentLogger.info("Attachment fetched");

    attachmentLogger.info("Create destination directory in needed");
    await mkdir(path.dirname(attachment.destination), {recursive: true});
    attachmentLogger.info("Destination directory available");

    attachmentLogger.info("Write attachment");
    await pipeline(
        Readable.fromWeb(resp.body),
        createWriteStream(attachment.destination)
    );
    attachmentLogger.info("Attachment written");
};

export const retrieveAttachments = async function (attachments, options = {}) {
    const limiter = new Bottleneck({
        reservoir: 500,
        reservoirRefreshAmount: 500,
        reservoirRefreshInterval: 5 * 60 * 1000,
        maxConcurrent: 1,
        minTime: 200,
        ...options
    });

    let attachmentsLogger = logger.child({attachments: attachments.length});

    attachmentsLogger.info('Begin retrieving attachments from JIRA')
    for (const attachment of attachments) {
        await limiter.schedule(() => retrieveAttachment(attachment));
    }
    attachmentsLogger.info('Completed retrieving attachments from JIRA')
};

export const getAttachments = async function (jiraExportData, options = {}) {
    let {dryRun, rateLimit, outputPath} = options;

    logger.info({
        'dry-run': dryRun ?? false,
        'rateLimit': rateLimit,
        'total-issues': jiraExportData.length,
    }, 'Begin fetching JIRA attachments');

    let attachments = compileAttachments(jiraExportData, outputPath);

    if (!dryRun) {
        try {
            await retrieveAttachments(attachments, rateLimit);
        } catch (error) {
            logger.fail(error, 'failed fetching JIRA attachments');
            throw (error);
        }
    }

    logger.info('Completed fetching JIRA attachments');

    return {attachments: attachments};
};
