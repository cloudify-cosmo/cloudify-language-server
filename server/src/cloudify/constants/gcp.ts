export const nodeTemplates = new Map(
    [
        [
            'cloudify.nodes.gcp.Network',
            {
                'auto_subnets': false,
            }
        ],
        [
            'cloudify.nodes.gcp.SubNetwork',
            {
                'region': 'us-east1',
                'subnet': '10.11.12.0/22',
            }
        ],
        [
            'cloudify.nodes.gcp.FirewallRule',
            {
                'allowed': {
                    'tcp': [
                        22
                    ]
                },
                'sources': ['0.0.0.0/0']

            }
        ],
        [
            'cloudify.nodes.gcp.Volume',
            {
                'image': 'https://www.googleapis.com/compute/v1/projects/centos-cloud/global/images/centos-7-v20191210',
                'size': 20,
                'boot': true,
            }
        ],
        [
            'cloudify.nodes.gcp.Instance',
            {
                'agent_config': {
                    'install_method': 'none',
                    'key': '',
                    'user': 'cloudifyuser',
                },
                'use_public_ip': true,
                'zone': 'us-east1',
                'external_ip': true,
            }
        ],
    ]
);
