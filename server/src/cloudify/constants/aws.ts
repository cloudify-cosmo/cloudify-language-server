export const nodeTemplates = new Map(
    [
        [
            'cloudify.nodes.aws.ec2.Vpc',
            {
                'resource_config': {
                    'CidrBlock': '10.10.0.0/16'
                }
            }
        ],
        [
            'cloudify.nodes.aws.ec2.Subnet',
            {
                'resource_config': {
                    'CidrBlock': '10.10.4.0/24',
                    'AvailabilityZone': 'us-east-1a'
                }
            }
        ],
        [
            'cloudify.nodes.aws.ec2.SecurityGroup',
            {
                'resource_config': {
                    'GroupName': 'ExampleSecurityGroup',
                    'Description': 'Example Security Group'
                }
            }
        ],
        [
            'cloudify.nodes.aws.ec2.SecurityGroupRuleIngress',
            {
                'resource_config': {
                    'IpPermissions': [
                        {
                            'IpProtocol': 'tcp',
                            'FromPort': 22,
                            'ToPort': 22,
                            'IpRanges': [{'CidrIp': '0.0.0.0/0'}],
                        }
                    ]
                }
            }
        ],
        [
            'cloudify.nodes.aws.iam.Role',
            {
                'resource_config': {
                    'RoleName': 'ExampleRole',
                    'Path': '/',
                    'AssumeRolePolicyDocument': {
                        'Version': '2012-10-17',
                        'Statement': [
                            {
                                'Effect': 'Allow',
                                'Principal': {
                                    'Service': 'eks.amazonaws.com',
                                },
                                'Action': 'sts:AssumeRole'
                            }
                        ]
                    }
                }
            }
        ],
    ]
);