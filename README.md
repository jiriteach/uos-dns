 <p float="left">
<img src="https://www.cloudflare.com/img/logo-cloudflare.svg" width="150">  
<img src="https://blog.ui.com/wp-content/uploads/2016/10/unifi-app-logo.png" width="150"> 
</p>

# Cloudflare DDNS (Dynamic DNS) - UniFi OS

`UnFi OS` has in-built support for DDNS for WAN connections but `Cloudflare` is not supported OOTB. This Cloudflare Worker is designed to provide the intermediary support required to allow `UnFi OS` to update Cloudflare using the OOTB options.

This Cloudflare Worker accepts parameters specified under `Settings > Internet > WAN > Dynamic DNS > custom` which `UniFi OS` uses to call whenever an IP change is detected. The Cloudflare Worker then calls Cloudflare DNS API to update the specified DNS A record with the new IP address.

Based on the implementation from - https://github.com/willswire/unifi-ddns⁠ - Thanks!

## Cloudflare requirements

You need to be using Cloudflare for you domain which means using Cloudflare nameservers and managing your domains DNS within Cloudflare.

## Install with Cloudflare Worker `Click to Deploy`

1. Deploy the Worker - [![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/workerforce/unifi-ddns)
2. In the Cloudflare Workers dashboard - note the `\*.workers.dev` URL
4. Create a Cloudflare API token to update DNS records - 
   - `https://dash.cloudflare.com/profile/api-tokens`
   - Click `Create token`, select `Create custom token`
   - Choose `Zone > DNS > Edit` for permissions, and include your zone under `Zone Resources` 
   - Copy the API Key which will be used later

## Install with Cloudflare Wrangler CLI

1. Clone or download this project
2. Ensure you have `Cloudflare [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)` installed
3. Log in with Cloudlfare Wrangler and run `wrangler deploy`
4. Note the `\*.workers.dev` URL after creation
5. Create an API token mentioned above

## Configuring UniFi OS

1. `https://unifi.ui.com/`
2. Click `Settings > Internet > WAN > Dynamic DNS`
3. Click `Create New Dynamic DNS` and enter the following parameters -
   - `Service`: Choose `custom`
   - `Hostname`: DNS record to update in `subdomain.domain.com` format to update (example - `subdomain.domain.com` or `domain.com` for root)
   - `Username`: Domain name (example `domain.com`)
   - `Password`: Cloudflare API Token as created above
   - `Server`: Cloudflare Worker URL `<worker-name>.<worker-subdomain>.workers.dev/update?ip=%i&hostname=%h`

## Testing on a UDM-Pro
Test the setup and force a manual update on a UDM-Pro -
1. SSH into your the UDM-Pro device
2. Run `ps aux | grep inadyn`
3. Note the configuration file path which looks similar to `/run/ddns-eth4-inadyn.conf`
4. Run `inadyn -n -1 --force -f <config-path>` (example - `inadyn -n -1 --force -f /run/ddns-eth4-inadyn.conf`)
5. Check the response and Cloudlare DNS or Cloudflare Worker logs
6. `/var/log/messages` can also be checked error messages

## Troubleshooting

- For subdomains (example - `subdomain.domain.com`) - create an A record manually in Cloudflare DNS first.
- For errors with hostname resolution (`inadyn[2173778]: Failed resolving hostname https: Name or service not known`), remove `https://` from the `Server` field
- If a second domain is required - `Create New Dynamic DNS` in UniFi OS and use the service `dyndns` with the same setup as above
