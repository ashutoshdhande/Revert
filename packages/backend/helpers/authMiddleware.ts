import { Request, Response } from 'express';
import prisma from '../prisma/client';

const revertAuthMiddleware = () => async (req: Request, res: Response, next: () => any) => {
    const nonSecurePaths = ['/oauth-callback', '/oauth/refresh'];
    if (nonSecurePaths.includes(req.path)) return next();
    const { 'x-revert-private-token': token } = req.headers;

    if (!token) {
        res.status(401).send({
            error: 'Api token unauthorized',
        });
        return;
    }
    try {
        const account = await prisma.accounts.findMany({
            where: {
                x_revert_private_token: token as string,
            },
        });
        if (!account || !account.length) {
            return res.status(401).send({
                error: 'Api token unauthorized',
            });
        }
        return next();
    } catch (error) {
        console.log('error', error);
        return res.status(400).send({
            error: 'Bad request',
        });
    }
};

export default revertAuthMiddleware;
