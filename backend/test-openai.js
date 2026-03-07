// Test OpenAI API Connection
require('dotenv').config();
const { createChatCompletion } = require('./config/openai');

async function testOpenAI() {
  console.log('Testing OpenAI API...');
  console.log('API Key:', process.env.OPENAI_API_KEY ? 'Present (starts with: ' + process.env.OPENAI_API_KEY.substring(0, 10) + '...)' : 'MISSING!');
  
  try {
    const response = await createChatCompletion([
      { role: 'user', content: 'Say "Hello, CampusAid!" if you can hear me.' }
    ], {
      model: 'gpt-4',
      max_tokens: 50
    });
    
    console.log('✓ SUCCESS! OpenAI Response:', response.choices[0].message.content);
  } catch (error) {
    console.error('✗ FAILED! Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testOpenAI();
