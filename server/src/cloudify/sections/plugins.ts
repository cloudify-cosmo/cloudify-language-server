/* --------------------------------------------------------------------------------------------
 * Copyright (c) Cloudify Platform LTD. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export const name = 'plugins';
export const keywords = [];
export const regex = /^cloudify-[a-z\\-]*-plugin$/;

export const list = [
    'cloudify-ansible-plugin',
    'cloudify-aws-plugin',
    'cloudify-azure-plugin',
    'cloudify-docker-plugin',
    'cloudify-fabric-plugin',
    'cloudify-gcp-plugin',
    'cloudify-helm-plugin',
    'cloudify-kubernetes-plugin',
    'cloudify-openstack-plugin',
    'cloudify-serverless-plugin',
    'cloudify-spot-ocean-plugin',
    'cloudify-starlingx-plugin',
    'cloudify-terraform-plugin',
    'cloudify-terragrunt-plugin',
    'cloudify-utilities-plugin',
    'cloudify-vsphere-plugin'
];

export class validator {
    name:string;
    constructor(name:string) {
        this.name = name;
    }
}
