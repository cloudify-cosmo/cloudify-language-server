/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fetch from 'node-fetch';
import {
    JSONItems
} from './utils';


// For casting the response of our Marketplace API.
interface JSONPagination {
    'size': number,
    'offset': number,
    'total': number,
}
interface JSONResponse<T> {
    items: JSONItems<T>;
    pagination: JSONPagination;
}

export function rawRequest<ItemType>(url:string, method:string, additionalParams={}): Promise<JSONResponse<ItemType>> {
    // For getting the response from a rest service.
    const params = {
        ...additionalParams,
        method: method,
        headers: {
            Accept: 'application/json',
        }
    };
    // console.log('Start rawRequest %s %s', url, method);
    const pr = fetch(url, params).then(
        resp => {
            return resp.json();
        }
    ) as Promise<JSONResponse<ItemType>>;
    return pr;
}

// export function paginatedRequest(
//     url:string,
//     method:string,
//     offset:integer=0,
//     size:integer=500,
//     collectedData:JSONItems,
//     additionalParams={}): Promise<JSONItems> {
//     // for getting paginated results.
//     const current_url:string = url + '?offset=' + offset + '&size=' + size;
//     const pr = rawRequest(current_url, method, additionalParams);
//     return pr.then(
//         result => {
//             for (const key in result.items) {
//                 const value = result.items[key];
//                 const offsetKey = offset + +key;
//                 collectedData[offsetKey] = value;

//             }
//             if (result.pagination.total > offset) {
//                 return paginatedRequest(
//                     url,
//                     method,
//                     offset + size,
//                     size,
//                     collectedData,
//                     additionalParams
//                 );
//             }
//             return collectedData;
//         }
//     );
// }
