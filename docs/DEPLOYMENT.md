# Deployment Setup Guide

## Prerequisites

- GitHub repository
- Cloudflare account
- Cloudflare Pages project

## Step 1: Create Cloudflare Pages Project

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to **Workers & Pages** → **Pages**
3. Click **Create a project**
4. Choose **Connect to Git** (or skip for direct upload)
5. Name your project: `family-tree-editor`

## Step 2: Get Cloudflare Credentials

### API Token

1. Go to **My Profile** → **API Tokens**
2. Click **Create Token**
3. Use template **Edit Cloudflare Workers**
4. Or create custom token with permissions:
   - Account → Cloudflare Pages → Edit
5. Copy the generated token

### Account ID

1. Go to **Workers & Pages**
2. Your Account ID is visible in the sidebar or URL
3. Or go to any Pages project, it's in the URL: `/pages/view/{account-id}/...`

## Step 3: Configure GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these secrets:

   **CLOUDFLARE_API_TOKEN**
   - Value: Your API token from Step 2

   **CLOUDFLARE_ACCOUNT_ID**
   - Value: Your Account ID from Step 2

## Step 4: Deploy

### Automatic Deployment

Simply push to the `main` branch:

```bash
git add .
git commit -m "Initial deployment"
git push origin main
```

The GitHub Action will automatically:
1. Install dependencies
2. Build the project
3. Deploy to Cloudflare Pages

### Manual Deployment (Alternative)

If you prefer manual deployment:

```bash
# Build locally
npm run build

# Install Wrangler CLI (if not installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler pages deploy dist --project-name=family-tree-editor
```

## Step 5: Verify Deployment

1. Check GitHub Actions tab in your repository
2. View the workflow run
3. Once complete, visit your Cloudflare Pages URL:
   - `https://family-tree-editor.pages.dev`
   - Or your custom domain

## Custom Domain (Optional)

1. Go to your Cloudflare Pages project
2. Click **Custom domains**
3. Add your domain
4. Follow DNS configuration instructions

## Troubleshooting

### Build Fails

- Check Node.js version (should be 20)
- Verify all dependencies are listed in package.json
- Check build logs in GitHub Actions

### Deployment Fails

- Verify API token has correct permissions
- Check Account ID is correct
- Ensure project name matches in workflow file

### Site Not Loading

- Check if build completed successfully
- Verify dist/ folder was deployed
- Check browser console for errors
- Clear cache and hard reload

## Environment Variables

If you need environment variables for production:

1. Add to Cloudflare Pages project settings
2. Or use `.env` files with Vite (not recommended for secrets)

## Rollback

To rollback to a previous version:

1. Go to Cloudflare Pages project
2. Click **Deployments**
3. Find the working deployment
4. Click **Manage** → **Rollback to this deployment**

## Monitoring

- **Analytics**: Available in Cloudflare Pages dashboard
- **Logs**: View build logs in GitHub Actions
- **Errors**: Check browser console and Cloudflare logs
