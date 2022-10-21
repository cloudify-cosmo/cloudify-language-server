/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	CompletionItemKind,
} from 'vscode-languageserver/node';
import fetch from 'node-fetch';


type RawPagination = {
	'size': number,
	'offset': number,
	'total': number,
}

type JSONResponse = {
    items: Object;
    pagination: RawPagination;
};

function rawRequest(url:string, method:string, additionalParams={}): Promise<JSONResponse> {
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
			return resp.json()
		}
	) as Promise<JSONResponse>;
	return pr;
}

function paginatedRequest(
	    url:string,
		method:string='GET',
		offset:number=0,
		size:number=500,
		data={},
		additionalParams={}): Promise<any> {
	const current_url:string = url + "?offset=" + offset + "&size=" + size;
    const pr = rawRequest(current_url, method, additionalParams);
	return pr.then(
		_data => {
			data = Object.assign({}, data, _data.items);
			if (_data.pagination.total > offset) {
				return paginatedRequest(url, method, offset + size, size, data);
			}
			return data;
		}
	)
}

export function getFromMarketplace(data={}, endpoint:string, protocol:string='https', domain:string='marketplace.cloudify.co') {
	const url = protocol + '://' + domain + '/' + endpoint;
	return paginatedRequest(url, 'GET', 0, 500, data);
}
