/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export const name = 'inputs';
export const keywords = [
    'default',
    'description',
    'display_label',
    'required',
    'type',
];
export const inputTypes = [
    'string',
    'integer',
    'boolean',
    'dict',
    'list'
];
export const inputTemplate = `# Input Template
input_template:
  type: string
  display_label: Input Name
  description: a deployment parameter
  default: ''
  required: true
`;

export const documentation = `Parameters that are injected into a blueprint when a deployment is created. These parameters can be referenced elsewhere in the blueprint with the get_input intrinsic function.

For more information, see https://docs.cloudify.co/latest/developer/blueprints/spec-inputs/`;

export class InputItem {
    raw;
    name:string;
    type:string;
    description:string;
    default:null|number|string|[]|object;
    required:boolean;

    constructor(raw:null|object) {
        if (raw == null) {
            raw = {};
        }

        this.raw = raw;

        this.name = '';
        this.type = '';
        this.description = '';
        this.default = null;
        this.required = false;
        this.assign();

    }

    assign=()=>{
        const input = Object(this.raw);
        for (const key of Object.keys(this.raw)) {          
            if (key == 'name') {
                this.name = input[key];
            } else if (key == 'type') {
                this.type = input[key];
            } else if (key == 'description') {
                this.description = input[key];
            } else if (key == 'default') {
                this.default = input[key];
            } else if (key == 'required') {
                this.required = input[key];
            }
        }
    };
}
