import React, { useState, useCallback } from 'react';

// --- Helper Components ---

// Simple loading spinner component
const Spinner = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

// Component for displaying error or info messages
const MessageBox = ({ message, type = 'error' }) => {
  if (!message) return null;
  const colors = type === 'error' ? 'bg-red-100 border-red-400 text-red-700' : 'bg-blue-100 border-blue-400 text-blue-700';
  return (
    <div className={`border px-4 py-3 rounded-lg relative ${colors}`} role="alert">
      <span className="block sm:inline">{message}</span>
    </div>
  );
};

// Main App Component
function App() {
  // --- State Management ---
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [thumbnailText, setThumbnailText] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('Vibrant & Bold');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState('');
  const [error, setError] = useState('');

  const styleOptions = [
    "Vibrant & Bold",
    "Minimalist & Clean",
    "Gaming / Neon",
    "Documentary",
  ];

  // --- File Handling ---
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Basic file type validation
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          setError('Please upload a valid image file (JPG, PNG, WEBP).');
          return;
      }
      setError('');
      setImageFile(file);
      // Create a preview URL for the image
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // --- Base64 Conversion ---
  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]); // Remove the data URI prefix
    reader.onerror = error => reject(error);
  });

  // --- API Call and Image Generation ---
  const generateThumbnail = useCallback(async () => {
    // 1. Validation
    if (!imageFile || !thumbnailText || !selectedStyle) {
      setError('Please upload an image, enter text, and select a style.');
      return;
    }

    setIsLoading(true);
    setError('');
    setGeneratedImage('');

    try {
      // 2. Convert image to Base64
      const base64ImageData = await toBase64(imageFile);

      // 3. Construct the dynamic prompt for the AI model
      const stylePrompts = {
        "Vibrant & Bold": "Use highly saturated, contrasting colors like bright yellows and electric blues. Add a thick, white glowing outline around the person. The background should be a dynamic, abstract explosion of color. The text should be bold, slightly tilted, and have a drop shadow to pop.",
        "Minimalist & Clean": "Use a simple, two-tone background with soft pastel colors. The composition should be uncluttered and balanced. Use a modern, elegant sans-serif font for the text. The person should be placed neatly to one side.",
        "Gaming / Neon": "Create a dark background with bright neon lights, lens flares, and digital glitch effects. Use a futuristic or pixelated font. Add a vibrant magenta or cyan glow around the person to make them stand out.",
        "Documentary": "Create a cinematic look with muted, desaturated colors and high contrast. The background should be slightly out of focus, suggesting a real-world environment. Use a classic, high-quality serif font. The overall mood should be serious and professional.",
      };

      const prompt = `Create a compelling, high-resolution (1280x720 aspect ratio) YouTube thumbnail.
      - Main Subject: Use the provided image of the person. IMPORTANT: Expertly cut out the person from their original background and place them prominently on the new thumbnail background.
      - Text: Incorporate the text "${thumbnailText}" in a large, highly readable font that fits the chosen style.
      - Style: Apply a "${selectedStyle}" theme. Specific style instructions: ${stylePrompts[selectedStyle]}`;
      
      // Use the API key from environment variables for local development, 
      // falling back to an empty string for environments like the Canvas where it's injected automatically.
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ""; 
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;

      // 4. Construct the API payload
      const payload = {
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: imageFile.type,
                data: base64ImageData
              }
            }
          ]
        }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"]
        },
      };

      // 5. API call with exponential backoff
      let response;
      let retries = 3;
      let delay = 1000;
      for (let i = 0; i < retries; i++) {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) break;

        if (response.status === 429 || response.status >= 500) {
          console.warn(`Request failed with status ${response.status}. Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          break; // Don't retry for other client-side errors
        }
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorBody}`);
      }
      
      const result = await response.json();

      // 6. Process the response
      const base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

      if (!base64Data) {
        throw new Error("No image data found in the API response. The model may have refused the request.");
      }

      setGeneratedImage(`data:image/png;base64,${base64Data}`);

    } catch (err) {
      console.error(err);
      setError(`An error occurred: ${err.message}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  }, [imageFile, thumbnailText, selectedStyle]);


  // --- Download Handler ---
  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `thumbnail-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- JSX Rendering ---
  return (
    <div className="bg-gray-900 min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans text-white">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            AI YouTube Thumbnail Generator
          </h1>
          <p className="text-gray-400 mt-2">Create stunning thumbnails in seconds with Gemini AI.</p>
        </header>

        <main className="bg-gray-800/50 backdrop-blur-sm p-6 md:p-8 rounded-2xl shadow-2xl border border-gray-700">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* --- Left Column: Inputs --- */}
            <div className="space-y-6">
              {/* 1. Image Upload */}
              <div>
                <label className="block text-lg font-semibold mb-2 text-gray-300">1. Upload Your Photo</label>
                <div 
                  className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-500 px-6 py-10 bg-gray-900/50 transition-colors hover:border-purple-400"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if(file) {
                          e.target.files = e.dataTransfer.files;
                          handleImageChange(e);
                      }
                  }}
                >
                  <div className="text-center">
                    {imagePreview ? (
                       <img src={imagePreview} alt="Preview" className="mx-auto h-24 w-24 sm:h-32 sm:w-32 object-cover rounded-lg shadow-md" />
                    ) : (
                      <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    <div className="mt-4 flex text-sm leading-6 text-gray-400">
                      <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-semibold text-purple-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-purple-500 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 hover:text-purple-300">
                        <span>Upload a file</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/webp" onChange={handleImageChange} />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs leading-5 text-gray-500">PNG, JPG, WEBP up to 10MB</p>
                  </div>
                </div>
              </div>

              {/* 2. Thumbnail Text */}
              <div>
                <label htmlFor="thumbnail-text" className="block text-lg font-semibold text-gray-300">2. Add Thumbnail Text</label>
                <input
                  type="text"
                  id="thumbnail-text"
                  value={thumbnailText}
                  onChange={(e) => setThumbnailText(e.target.value)}
                  placeholder="e.g., MY BIGGEST SECRET!"
                  className="mt-2 block w-full bg-gray-900/80 border-gray-600 rounded-lg shadow-sm py-3 px-4 focus:border-purple-500 focus:ring focus:ring-purple-500 focus:ring-opacity-50 transition"
                />
              </div>

              {/* 3. Style Selection */}
              <div>
                 <label className="block text-lg font-semibold text-gray-300">3. Choose a Style</label>
                 <div className="mt-2 grid grid-cols-2 gap-3">
                    {styleOptions.map(style => (
                        <button
                            key={style}
                            onClick={() => setSelectedStyle(style)}
                            className={`px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-purple-500
                                ${selectedStyle === style ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                        >
                            {style}
                        </button>
                    ))}
                 </div>
              </div>

              {/* 4. Generate Button */}
              <button
                onClick={generateThumbnail}
                disabled={isLoading || !imageFile || !thumbnailText}
                className="w-full flex items-center justify-center bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-4 px-4 rounded-lg shadow-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
              >
                {isLoading ? (
                  <>
                    <Spinner />
                    Generating...
                  </>
                ) : 'Generate Thumbnail'}
              </button>
            </div>

            {/* --- Right Column: Output --- */}
            <div className="flex flex-col items-center justify-center bg-gray-900/50 rounded-lg border border-dashed border-gray-600 min-h-[320px] lg:min-h-full p-4">
                {isLoading && (
                    <div className="text-center">
                        <Spinner/>
                        <p className="text-gray-400 mt-2">AI is working its magic...</p>
                        <p className="text-xs text-gray-500">This might take a moment.</p>
                    </div>
                )}
                <MessageBox message={error} type="error"/>
                {!isLoading && !generatedImage && !error && (
                    <div className="text-center text-gray-500">
                        <p>Your generated thumbnail will appear here</p>
                    </div>
                )}
                {generatedImage && (
                    <div className="w-full space-y-4">
                         <img src={generatedImage} alt="Generated Thumbnail" className="w-full h-auto object-contain rounded-lg shadow-2xl"/>
                         <button
                            onClick={handleDownload}
                            className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-colors duration-200"
                         >
                            Download Thumbnail
                         </button>
                    </div>
                )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;

