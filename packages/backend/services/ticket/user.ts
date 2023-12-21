import revertAuthMiddleware from '../../helpers/authMiddleware';
import revertTenantMiddleware from '../../helpers/tenantIdMiddleware';
import { logInfo, logError } from '../../helpers/logger';
import { isStandardError } from '../../helpers/error';
import { InternalServerError, NotFoundError } from '../../generated/typescript/api/resources/common';
import { TP_ID } from '@prisma/client';
import { UserService } from '../../generated/typescript/api/resources/ticket/resources/user/service/UserService';
import axios from 'axios';
import { UnifiedTicketUser } from '../../models/unified/ticketUsers';
import { unifyObject } from '../../helpers/crm/transform';
import { TicketStandardObjects } from '../../constants/common';
import { LinearClient } from '@linear/sdk';

const objType = TicketStandardObjects.ticketUser;

const userServiceTicket = new UserService(
    {
        async getUser(req, res) {
            try {
                const connection = res.locals.connection;
                const account = res.locals.account;
                const userId = req.params.id;
                // const fields = req.query.fields;
                const thirdPartyId = connection.tp_id;
                const thirdPartyToken = connection.tp_access_token;
                const tenantId = connection.t_id;
                logInfo(
                    'Revert::GET USER',
                    connection.app?.env?.accountId,
                    tenantId,
                    thirdPartyId,
                    thirdPartyToken,
                    userId
                );

                switch (thirdPartyId) {
                    case TP_ID.linear: {
                        const linear = new LinearClient({
                            accessToken: thirdPartyToken,
                        });
                        const user = await linear.user(userId);

                        const unifiedUser = await unifyObject<any, UnifiedTicketUser>({
                            obj: user,
                            tpId: thirdPartyId,
                            objType,
                            tenantSchemaMappingId: connection.schema_mapping_id,
                            accountFieldMappingConfig: account.accountFieldMappingConfig,
                        });

                        res.send({
                            status: 'ok',
                            result: unifiedUser,
                        });
                        break;
                    }
                    case TP_ID.clickup: {
                        res.send({
                            status: 'ok',
                            result: 'This endpoint is currently not supported',
                        });
                        break;
                    }
                    default: {
                        throw new NotFoundError({ error: 'Unrecognized app' });
                    }
                }
            } catch (error: any) {
                logError(error);
                console.error('Could not fetch user', error);
                if (isStandardError(error)) {
                    throw error;
                }
                throw new InternalServerError({ error: 'Internal server error' });
            }
        },
        async getUsers(req, res) {
            try {
                const connection = res.locals.connection;
                const account = res.locals.account;
                const fields: any = req.query.fields;
                const pageSize = parseInt(String(req.query.pageSize));
                const cursor = req.query.cursor;
                const thirdPartyId = connection.tp_id;
                const thirdPartyToken = connection.tp_access_token;
                const tenantId = connection.t_id;
                logInfo(
                    'Revert::GET ALL USERS',
                    connection.app?.env?.accountId,
                    tenantId,
                    thirdPartyId,
                    thirdPartyToken
                );
                switch (thirdPartyId) {
                    case TP_ID.linear: {
                        const linear = new LinearClient({
                            accessToken: thirdPartyToken,
                        });

                        /*
                            In GraphQL, either 'first' & 'after' or 'last' & 'before' can exist but not both simultaneously.
                            To determine the appropriate pagination direction, an additional flag parameter is required.
                        */
                        const variables = {
                            first: pageSize ? pageSize : null,
                            after: cursor ? cursor : null,
                            last: null,
                            Before: null,
                        };

                        const result = await linear.users(variables);

                        const unifiedUsers = await Promise.all(
                            result.nodes.map(
                                async (user: any) =>
                                    await unifyObject<any, UnifiedTicketUser>({
                                        obj: user,
                                        tpId: thirdPartyId,
                                        objType,
                                        tenantSchemaMappingId: connection.schema_mapping_id,
                                        accountFieldMappingConfig: account.accountFieldMappingConfig,
                                    })
                            )
                        );

                        const pageInfo = result.pageInfo;
                        let next_cursor = undefined;
                        if (pageInfo.hasNextPage && pageInfo.endCursor) {
                            next_cursor = pageInfo.endCursor;
                        }

                        let previous_cursor = undefined;
                        if (pageInfo.hasPreviousPage && pageInfo.startCursor) {
                            previous_cursor = pageInfo.startCursor;
                        }

                        res.send({
                            status: 'ok',
                            next: next_cursor,
                            previous: previous_cursor,
                            results: unifiedUsers,
                        });

                        break;
                    }
                    case TP_ID.clickup: {
                        let parsedFields: any = fields ? JSON.parse(fields) : undefined;
                        const result: any = await axios({
                            method: 'get',
                            url: `https://api.clickup.com/api/v2/list/${parsedFields.listId}/member`,
                            headers: {
                                Authorization: `Bearer ${thirdPartyToken}`,
                                'Content-Type': 'application/json',
                            },
                        });
                        const unnifiedMembers: any = await Promise.all(
                            result.data.members.map(
                                async (user: any) =>
                                    await unifyObject<any, UnifiedTicketUser>({
                                        obj: user,
                                        tpId: thirdPartyId,
                                        objType,
                                        tenantSchemaMappingId: connection.schema_mapping_id,
                                        accountFieldMappingConfig: account.accountFieldMappingConfig,
                                    })
                            )
                        );
                        res.send({
                            status: 'ok',
                            next: undefined,
                            previous: undefined,
                            results: unnifiedMembers,
                        });
                        break;
                    }
                    default: {
                        throw new NotFoundError({ error: 'Unrecognized app' });
                    }
                }
            } catch (error: any) {
                logError(error);
                console.error('Could not fetch users', error);
                if (isStandardError(error)) {
                    throw error;
                }
                throw new InternalServerError({ error: 'Internal server error' });
            }
        },
    },
    [revertAuthMiddleware(), revertTenantMiddleware()]
);

export { userServiceTicket };
