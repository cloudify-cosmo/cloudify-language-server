export const nodeTemplates = new Map(
    [
        [
            'cloudify.nodes.azure.ResourceGroup',
            {
                'name': 'examplegroup',
                'location': 'eastus'
            }
        ],
        [
            'cloudify.nodes.azure.network.VirtualNetwork',
            {
                'resource_group_name': 'examplegroup',
                'name': 'examplenetwork',
                'location': 'eastus'
            }
        ],
        [
            'cloudify.nodes.azure.network.Subnet',
            {
                'resource_group_name': 'examplegroup',
                'name': 'examplesubnet',
                'location': 'eastus',
                'resource_config': {
                    'addressPrefix': '10.10.4.0/24',
                }

            }
        ],
        [
            'cloudify.nodes.azure.network.NetworkInterfaceCard',
            {
                'resource_group_name': 'examplegroup',
                'location': 'eastus',
            }
        ],
        [
            'cloudify.nodes.azure.network.IPConfiguration',
            {
                'resource_group_name': 'examplegroup',
                'location': 'eastus',
                'resource_config': {
                    'privateIPAllocationMethod': 'Dynamic',
                }

            }
        ],
        [
            'cloudify.nodes.azure.network.PublicIPAddress',
            {
                'resource_group_name': 'examplegroup',
                'location': 'eastus',
                'resource_config': {
                    'publicIPAllocationMethod': 'Static',
                }
            }
        ],
        [
            'cloudify.nodes.azure.network.NetworkSecurityGroup',
            {
                'resource_group_name': 'examplegroup',
                'name': 'examplesecurity',
                'location': 'eastus',
                'resource_config': {
                    'securityRules': [
                        {
                            'name': 'ssh',
                            'properties': {
                                'description': 'inbound ssh',
                                'protocol': 'Tcp',
                                'sourcePortRange': '*',
                                'destinationPortRange': 22,
                                'sourceAddressPrefix': '*',
                                'destinationAddressPrefix': 22,
                                'priority': 100,
                                'access': 'Allow',
                                'direction': 'Inbound',
                            }
                        }
                    ]
                }

            }
        ],
        [
            'cloudify.nodes.azure.compute.VirtualMachine',
            {
                'agent_config': {
                    'install_method': 'none',
                    'key': '',
                    'user': 'cloudifyuser',
                },
                'resource_group_name': 'examplegroup',
                'name': 'examplesecurity',
                'os_family': 'linux',
                'location': 'eastus',
                'resource_config': {
                    'hardwareProfile': {
                        'vmSize': 'Standard_B1s',
                    },
                    'storageProfile': {
                        'imageReference': {
                            'publisher': 'OpenLogic',
                            'offer': 'CentOS',
                            'sku': '7.6',
                            'version': 'latest',
                        },
                    },
                    'osProfile': {
                        'adminUsername': 'cloudifyuser',
                        'adminPassword': '',
                        'linuxConfiguration': {
                            'disablePasswordAuthentication': true,
                            'ssh': {
                                'publicKeys': [
                                    {
                                        'keydata': '',
                                        'path': '/home/cloudifyuser/.ssh/authorized_keys'    
                                    }
                                ]
                            }
                        }
                    },
                }
            }
        ],
        [
            'cloudify.nodes.azure.storage.StorageAccount',
            {
                'resource_group_name': 'examplegroup',
                'location': 'eastus',
                'resource_config': {
                    'accountType': 'Standard_LRS',
                }

            }
        ],
        [
            'cloudify.nodes.azure.compute.AvailabilitySet',
            {
                'resource_group_name': 'examplegroup',
                'name': 'exampleset',
                'location': 'eastus',
            }
        ],
    ]
);
