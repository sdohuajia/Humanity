# Load proxies from a file
def load_proxies(file_path):
    with open(file_path, 'r') as file:
        return [line.strip() for line in file if line.strip()]

# Main execution
if __name__ == "__main__":
    rpc_url = 'https://rpc.testnet.humanity.org'
    
    # Load private keys and proxies
    private_keys = load_private_keys('private_keys.txt')
    proxies = load_proxies('proxy.txt')

    # Ensure the number of private keys matches the number of proxies
    if len(private_keys) != len(proxies):
        print(Fore.RED + "Error: The number of private keys must match the number of proxies.")
        sys.exit(1)

    # Create a list of web3 instances, one for each proxy
    web3_instances = []
    for proxy in proxies:
        web3 = Web3(Web3.HTTPProvider(rpc_url, {"http": proxy, "https": proxy}))
        if web3.is_connected():
            print(Fore.GREEN + f"Connected to Humanity Protocol using proxy: {proxy}")
            web3_instances.append(web3)
        else:
            print(Fore.RED + f"Connection failed using proxy: {proxy}")
            sys.exit(1)  # Exit if connection fails

    # Create a contract instance for each web3 instance
    contracts = [web3.eth.contract(address=Web3.to_checksum_address(contract_address), abi=contract_abi) for web3 in web3_instances]

    # Display Twitter follow message
    print(Fore.CYAN + "关注推特 @ferdie_jhovie，获取更多脚本持续更新。")

    # Infinite loop to run every 6 hours
    while True:
        for i, private_key in enumerate(private_keys):
            claim_rewards(private_key, web3_instances[i], contracts[i])
        
        print(Fore.CYAN + "Waiting for 6 hours before the next run...")
        time.sleep(6 * 60 * 60)  # For testing purposes, you may want to reduce this time
