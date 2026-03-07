const OpenAI = require('openai');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Validate API key on startup
const validateApiKey = async () => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠ Warning: OPENAI_API_KEY not set in environment variables');
      return false;
    }
    
    // Test API connection with a minimal request
    await openai.models.list();
    console.log('✓ OpenAI API connected successfully');
    return true;
  } catch (error) {
    console.error('✗ OpenAI API connection failed:', error.message);
    return false;
  }
};

// Helper function to create chat completion
const createChatCompletion = async (messages, options = {}) => {
  try {
    // Determine which parameter to use based on model
    const model = options.model || process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    const isGPT5 = model.includes('gpt-5') || model.includes('o1') || model.includes('o4');
    
    const params = {
      model: model,
      messages: messages,
      stream: options.stream || false,
      ...options
    };
    
    // GPT-5 models don't support custom temperature, use default
    if (!isGPT5) {
      params.temperature = options.temperature || 0.7;
    }
    
    // Use correct token parameter based on model
    // GPT-5 and o1/o4 models use max_completion_tokens
    // GPT-4 and GPT-3.5 use max_tokens
    if (isGPT5) {
      params.max_completion_tokens = options.max_tokens || parseInt(process.env.OPENAI_MAX_TOKENS) || 1000;
      // Remove max_tokens if it was passed in options
      delete params.max_tokens;
    } else {
      params.max_tokens = options.max_tokens || parseInt(process.env.OPENAI_MAX_TOKENS) || 1000;
    }
    
    const response = await openai.chat.completions.create(params);
    
    return response;
  } catch (error) {
    console.error('OpenAI completion error:', error.message);
    throw error;
  }
};

// Helper function to create embeddings
const createEmbedding = async (text, model = 'text-embedding-3-small') => {
  try {
    const response = await openai.embeddings.create({
      model: model,
      input: text
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('OpenAI embedding error:', error.message);
    throw error;
  }
};

// Helper function to create embeddings for multiple texts
const createEmbeddings = async (texts, model = 'text-embedding-3-small') => {
  try {
    const response = await openai.embeddings.create({
      model: model,
      input: texts
    });
    
    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error('OpenAI embeddings error:', error.message);
    throw error;
  }
};

// Helper function for streaming responses
const createStreamingCompletion = async (messages, onChunk, options = {}) => {
  try {
    const model = options.model || process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    const isGPT5 = model.includes('gpt-5') || model.includes('o1') || model.includes('o4');
    
    const params = {
      model: model,
      messages: messages,
      temperature: options.temperature || 0.7,
      stream: true,
      ...options
    };
    
    // Use correct token parameter
    if (isGPT5) {
      params.max_completion_tokens = options.max_tokens || parseInt(process.env.OPENAI_MAX_TOKENS) || 1000;
      delete params.max_tokens;
    } else {
      params.max_tokens = options.max_tokens || parseInt(process.env.OPENAI_MAX_TOKENS) || 1000;
    }

    const stream = await openai.chat.completions.create(params);

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        onChunk(content);
      }
    }
  } catch (error) {
    console.error('OpenAI streaming error:', error.message);
    throw error;
  }
};

module.exports = {
  openai,
  validateApiKey,
  createChatCompletion,
  createEmbedding,
  createEmbeddings,
  createStreamingCompletion
};