import React, { useState, useEffect } from 'react';
import { Key, Check, X, AlertCircle, Info, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { geminiService } from '../services/geminiVisionService';
import { saveGeminiAPIKey, loadGeminiAPIKey, hasGeminiAPIKey, removeGeminiAPIKey } from '../utils/encryption';

interface GeminiAPISettingsProps {
  onSave?: () => void;
  onClose?: () => void;
}

export const GeminiAPISettings: React.FC<GeminiAPISettingsProps> = ({ onSave, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [hasExistingKey, setHasExistingKey] = useState(false);

  useEffect(() => {
    // Check if API key exists and load it
    if (hasGeminiAPIKey()) {
      setHasExistingKey(true);
      const existingKey = loadGeminiAPIKey();
      if (existingKey) {
        setApiKey(existingKey);
        // Initialize gemini service with existing key
        try {
          geminiService.initialize(existingKey);
        } catch (error) {
          console.error('Failed to initialize Gemini with existing key:', error);
        }
      }
    }
  }, []);

  const handleTestConnection = async () => {
    if (!apiKey || apiKey.trim() === '') {
      setTestResult('error');
      setTestMessage('Please enter an API key');
      return;
    }

    setTesting(true);
    setTestResult(null);
    setTestMessage('');

    try {
      // Initialize Gemini service
      geminiService.initialize(apiKey);
      
      // Test connection
      // Note: We use geminiVisionService's internal test which now handles model fallbacks
      const success = await geminiService.testConnection();
      
      if (success) {
        setTestResult('success');
        setTestMessage('✅ Connection successful! API key is valid.');
        
        // Save API key (encrypted)
        saveGeminiAPIKey(apiKey);
        setHasExistingKey(true);
      } else {
        throw new Error('Connection test failed');
      }
    } catch (error: any) {
      console.error('Test connection error:', error);
      setTestResult('error');
      
      if (error.message?.includes('API_KEY_INVALID')) {
        setTestMessage('❌ Invalid API key. Please check your key and try again.');
      } else if (error.message?.includes('RATE_LIMIT')) {
        setTestMessage('❌ Rate limit exceeded. Please wait and try again.');
      } else {
        setTestMessage(`❌ Connection failed: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (testResult === 'success') {
      saveGeminiAPIKey(apiKey);
      if (onSave) {
        onSave();
      }
      if (onClose) {
        onClose();
      }
    } else {
      alert('Please test the connection first to ensure API key is valid.');
    }
  };

  const handleRemove = () => {
    if (confirm('Are you sure you want to remove the API key?')) {
      removeGeminiAPIKey();
      setApiKey('');
      setHasExistingKey(false);
      setTestResult(null);
      setTestMessage('');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Key className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Gemini AI Configuration</h3>
            <p className="text-sm text-gray-500">Configure your Google Gemini API key for AI analysis</p>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <p className="text-blue-900 font-medium mb-1">Get your FREE API Key</p>
            <p className="text-blue-800 mb-2">
              Gemini API offers 1,500 FREE requests per day - perfect for AI Auto Upload!
              <br />
              <span className="text-xs">Using: Gemini 2.5 Flash (stable multimodal model)</span>
            </p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
            >
              Get API Key from Google AI Studio
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* API Key Input */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gemini API Key {hasExistingKey && <span className="text-green-600">(Saved)</span>}
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestResult(null);
                setTestMessage('');
              }}
              placeholder="AIzaSy..."
              className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Your API key will be encrypted and stored securely in your browser.
          </p>
        </div>

        {/* Test Connection Button */}
        <div className="flex gap-3">
          <button
            onClick={handleTestConnection}
            disabled={!apiKey || testing}
            className={`
              flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
              ${!apiKey || testing
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700 shadow-md hover:shadow-lg'
              }
            `}
          >
            {testing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Testing Connection...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Test Connection</span>
              </>
            )}
          </button>

          {hasExistingKey && (
            <button
              onClick={handleRemove}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-all"
            >
              Remove Key
            </button>
          )}
        </div>

        {/* Test Result */}
        {testResult && (
          <div
            className={`
              flex items-start gap-3 p-4 rounded-lg border
              ${testResult === 'success'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
              }
            `}
          >
            {testResult === 'success' ? (
              <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p
                className={`
                  text-sm font-medium
                  ${testResult === 'success' ? 'text-green-900' : 'text-red-900'}
                `}
              >
                {testMessage}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Rate Limit Info */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">📊 Rate Limits (FREE Tier)</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Per Minute</p>
            <p className="text-lg font-bold text-gray-900">15 requests</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Per Day</p>
            <p className="text-lg font-bold text-gray-900">1,500 requests</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          💡 Typical usage: ~5-10 requests per product upload (analyzing images + comparison)
        </p>
      </div>

      {/* Action Buttons (if in modal) */}
      {(onSave || onClose) && (
        <div className="mt-6 flex gap-3 justify-end">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
          )}
          {onSave && (
            <button
              onClick={handleSave}
              disabled={testResult !== 'success'}
              className={`
                px-4 py-2 rounded-lg font-medium transition-all
                ${testResult === 'success'
                  ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-md'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              Save & Close
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default GeminiAPISettings;
