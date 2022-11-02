/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import fetch from 'node-fetch';

// For casting the response of our Marketplace API.
interface JSONPagination {
	'size': number,
	'offset': number,
	'total': number,
}
export interface JSONItems {
    [key: string]: Object;
}
interface JSONResponse {
    items: JSONItems;
	pagination: JSONPagination;
};

export function rawRequest(url:string, method:string, additionalParams={}): Promise<JSONResponse> {
    // For getting the response from a rest service.
	const params = {
		...additionalParams,
		method: method,
		headers: {
			Accept: 'application/json',
		}
	}
	console.log('Start rawRequest %s %s', url, method)
	const pr = fetch(url, params).then(
		resp => {
			return resp.json();
		}
	) as Promise<JSONResponse>;
	return pr;
}

export function paginatedRequest(
	    url:string,
		method:string,
		offset:number=0,
		size:number=500,
		collectedData:JSONItems={},
		additionalParams={}): Promise<JSONItems> {
	// for getting paginated results.
	const current_url:string = url + "?offset=" + offset + "&size=" + size;
    const pr = rawRequest(current_url, method, additionalParams);
	return pr.then(
		_data => {
			for (let key in _data.items) {
				let value = _data.items[key];
				let offsetKey = offset + +key;
				collectedData[offsetKey] = value;

			}
			if (_data.pagination.total > offset) {
				return paginatedRequest(
					url,
					method,
					offset + size,
					size,
					collectedData,
					additionalParams
				);
			}
			return collectedData;
		}
	)
}
