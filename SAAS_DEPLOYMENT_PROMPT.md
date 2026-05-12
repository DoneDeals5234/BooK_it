# Prompt: SaaS One-Click Website Deployment System

## Objective
Implement an automated "One-Click Deploy" system where users of the "Book It" app can launch their own websites on a custom subdomain (e.g., `shopname.yourdomain.com`). The system must use a Google Cloud VM for hosting and dynamic routing to serve thousands of sites from a single engine.

## Infrastructure Details
- **VM Name:** websites
- **Project ID:** project-1d71e202-bdcd-4468-afa
- **Zone:** us-central1-f
- **SSH Access Command:** 
  `gcloud compute ssh --zone "us-central1-f" "websites" --project "project-1d71e202-bdcd-4468-afa"`

## Implementation Steps

### Step 1: DNS & Wildcard Setup (GoDaddy)
1. Assign a **Static External IP** to the Google Cloud VM.
2. In GoDaddy DNS, create a **Wildcard A Record**:
   - Type: `A`, Name: `*`, Value: `[VM_STATIC_IP]`
3. Create a root `A` record:
   - Type: `A`, Name: `@`, Value: `[VM_STATIC_IP]`

### Step 2: VM Web Server Configuration (Nginx)
1. Install Nginx on the VM.
2. Configure a server block to listen for `*.yourdomain.com`.
3. Set up **SSL certificates** using Certbot with the DNS-01 challenge for Wildcard support.
4. Proxy all incoming traffic to the internal Node.js/React "Website Engine".

### Step 3: Dynamic Website Engine
1. Build/Deploy a central application on the VM.
2. **Logic:** The app must inspect the `Host` header of the incoming request.
3. **Database Integration:** 
   - Extract the subdomain (e.g., `pizza-hut`).
   - Query the Supabase `shops` or `shop_websites` table for that subdomain.
   - Fetch the shop's specific data (logo, colors, products, name).
   - Render the page dynamically based on this data.

### Step 4: App Integration (The "Deploy" Button)
1. Update the "Websites" button in the Book It app.
2. When clicked, it should call a Supabase function to:
   - Validate the shop name.
   - Generate a unique subdomain.
   - Update the database to set `is_website_active = true`.
3. Provide the user with their new URL: `https://[subdomain].yourdomain.com`.

## Guidelines for Execution
- Start by verifying the `gcloud` connection using the provided SSH command.
- Ensure the VM has Docker or Node.js installed for the Website Engine.
- Prioritize security: Ensure users cannot hijack other subdomains.
