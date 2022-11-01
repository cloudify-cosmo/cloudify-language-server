import * as fs from 'fs';

import {parse} from 'yaml';

export function getParsed(uri:string) {
	if (uri.startsWith('file://')) {
		uri = uri.replace('file://', '');
	} else if (uri.startsWith('file:/')) {
		uri = uri.replace('file:/', '');
	}
	let parsed = Object();
	console.log('Reading ' + uri);
	try {
		const file = fs.readFileSync(uri, 'utf8')
		parsed = parse(file);	
	} catch {
		console.log('Error');
	}
	console.log('Read ' + parsed);
	return parsed
}
