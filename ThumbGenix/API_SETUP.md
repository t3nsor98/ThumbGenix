# API Setup and Rate Limiting Guide

## Getting Your API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Navigate to "Get API key" in the left sidebar
4. Create a new API key or use an existing one
5. Copy the API key

## Setting Up Environment Variables

### Option 1: Create a .env file (Recommended)
Create a `.env` file in the root directory of the project:

```bash
=your_api_key_here
```

### Option 2: Use the hardcoded key (Not recommended for production)
The app currently has a fallback API key, but it's recommended to use your own key.

## Rate Limiting

### Free Tier Limits
- **Requests per minute**: ~15 requests
- **Requests per day**: ~1500 requests
- **Input tokens per minute**: Limited

### What We've Implemented
1. **Client-side rate limiting**: 2-second minimum interval between requests
2. **Maximum 10 requests per minute** (conservative limit)
3. **Automatic retry with exponential backoff**
4. **User-friendly error messages**
5. **Visual indicators when rate limited**

### Best Practices
1. **Wait 2+ seconds between requests**
2. **Don't spam the generate button**
3. **Consider upgrading to a paid plan for higher limits**
4. **Monitor your usage in Google AI Studio**

## Troubleshooting

### 429 Error (Too Many Requests)
- Wait a few minutes before trying again
- Check your API usage in Google AI Studio
- Consider upgrading your plan

### 403 Error (Access Denied)
- Verify your API key is correct
- Check if billing is enabled (required for some features)
- Ensure your account has access to Gemini API

### Other Errors
- Check your internet connection
- Verify the image file is valid (JPG, PNG, WEBP)
- Try with a smaller image file

## Upgrading Your Plan

If you need higher rate limits:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable billing for your project
3. Set up quota increases for Gemini API
4. Monitor usage and costs

## Security Notes

- Never commit your API key to version control
- Use environment variables for production
- Regularly rotate your API keys
- Monitor your API usage for unexpected charges
