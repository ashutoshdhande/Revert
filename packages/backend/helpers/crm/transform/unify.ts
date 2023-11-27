import { accountFieldMappingConfig } from '@prisma/client';
import { CRM_TP_ID, ChatStandardObjects, StandardObjects } from '../../../constants/common';
import { transformFieldMappingToModel } from '.';
import { preprocessUnifyObject } from './preprocess';

export async function unifyObject<T extends Record<string, any>, K>({
    obj,
    tpId,
    objType,
    tenantSchemaMappingId,
    accountFieldMappingConfig,
}: {
    obj: T;
    tpId: CRM_TP_ID;
    objType: StandardObjects | ChatStandardObjects;
    tenantSchemaMappingId?: string;
    accountFieldMappingConfig?: accountFieldMappingConfig;
}): Promise<K> {
    const processedObj = preprocessUnifyObject({ obj, tpId, objType });
    const transformedObject = await transformFieldMappingToModel({
        obj: processedObj,
        tpId,
        objType,
        tenantSchemaMappingId,
        accountFieldMappingConfig,
    });
    const unifiedObject = {
        ...transformedObject,
        additional: {
            ...(transformedObject.additional || {}),
        },
    };

    // Map additional fields
    Object.keys(obj).forEach((key) => {
        if (!(key in unifiedObject) && key !== 'properties') {
            unifiedObject['additional'][key] = obj[key];
        }
    });

    return unifiedObject as K;
}
