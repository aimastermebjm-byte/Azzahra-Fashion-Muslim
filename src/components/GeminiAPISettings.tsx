import React, { useState, useEffect } from 'react';
import { Key, Check, X, AlertCircle, Info, ExternalLink, Eye, EyeOff, Cpu, Zap } from 'lucide-react';
import { geminiService } from '../services/geminiVisionService';
import { 
  saveGeminiAPIKey, loadGeminiAPIKey, hasGeminiAPIKey, removeGeminiAPIKey,
  saveGLMAPIKey, loadGLMAPIKey, hasGLMAPIKey, removeGLMAPIKey,
  saveAPIKey, loadAPIKeyWithFallback, hasAPIKeyWithFallback, removeAPIKey
} from '../utils/encryption';

type AIProvider = 'gemini' | 'glm';

interface GeminiAPISettingsProps {
  onSave?: () => void;
  onClose?: () => void;
}

export const GeminiAPISettings: React.FC<GeminiAPISettingsProps> = ({ onSave, onClose }) => {
  const [activeTab, setActiveTab] = useState<AIProvider>('gemini');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [glmApiKey, setGlmApiKey] = useState('');
  const [showGeminiApiKey, setShowGeminiApiKey] = useState(false);
  const [showGlmApiKey, setShowGlmApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [hasExistingGeminiKey, setHasExistingGeminiKey] = useState(false);
  const [hasExistingGlmKey, setHasExistingGlmKey] = useState(false);
  const [saveGlobally, setSaveGlobally] = useState(true); // Default: save globally for cross-device sync

  useEffect(() => {
    // Check if API keys exist and load them (with global storage fallback)
    const loadKeys = async () => {
      try {
        // Try to load from localStorage first, then global storage
        const geminiKey = await loadAPIKeyWithFallback('gemini');
        const glmKey = await loadAPIKeyWithFallback('glm');
        
        if (geminiKey) {
          setHasExistingGeminiKey(true);
          setGeminiApiKey(geminiKey);
        }
        
        if (glmKey) {
          setHasExistingGlmKey(true);
          setGlmApiKey(glmKey);
        }
        
        // Initialize service with both keys if available
        if (geminiKey || glmKey) {
          try {
            geminiService.initialize(geminiKey || '', glmKey || '');
          } catch (error) {
            console.error('Failed to initialize AI service with existing keys:', error);
          }
        }
      } catch (error) {
        console.error('Failed to load API keys:', error);
        // Fallback to localStorage-only check
        const geminiKeyLocal = hasGeminiAPIKey() ? loadGeminiAPIKey() : null;
        const glmKeyLocal = hasGLMAPIKey() ? loadGLMAPIKey() : null;
        
        if (geminiKeyLocal) {
          setHasExistingGeminiKey(true);
          setGeminiApiKey(geminiKeyLocal);
        }
        
        if (glmKeyLocal) {
          setHasExistingGlmKey(true);
          setGlmApiKey(glmKeyLocal);
        }
      }
    };
    
    loadKeys();
  }, []);

  const handleTestConnection = async () => {
    if (activeTab === 'gemini') {
      if (!geminiApiKey || geminiApiKey.trim() === '') {
        setTestResult('error');
        setTestMessage('Please enter a Gemini API key');
        return;
      }

      setTesting(true);
      setTestResult(null);
      setTestMessage('');

      try {
        // Initialize Gemini service
        geminiService.initialize(geminiApiKey, glmApiKey || '');
        
        // Test connection
        const success = await geminiService.testConnection('gemini');
        
        if (success) {
          setTestResult('success');
          setTestMessage('✅ Gemini connection successful! API key is valid.');
          
          // Save API key (encrypted) with global storage option
          await saveAPIKey('gemini', geminiApiKey, { saveGlobal: saveGlobally });
          setHasExistingGeminiKey(true);
        } else {
          throw new Error('Connection test failed');
        }
      } catch (error: any) {
        console.error('Gemini test connection error:', error);
        setTestResult('error');
        
        if (error.message?.includes('API_KEY_INVALID')) {
          setTestMessage('❌ Invalid Gemini API key. Please check your key and try again.');
        } else if (error.message?.includes('RATE_LIMIT')) {
          setTestMessage('❌ Gemini rate limit exceeded. Please wait and try again.');
        } else {
          setTestMessage(`❌ Gemini connection failed: ${error.message || 'Unknown error'}`);
        }
      } finally {
        setTesting(false);
      }
    } else {
      // GLM tab
      if (!glmApiKey || glmApiKey.trim() === '') {
        setTestResult('error');
        setTestMessage('Please enter a GLM API key');
        return;
      }

      setTesting(true);
      setTestResult(null);
      setTestMessage('');

      try {
        // Initialize Gemini service with GLM key (service will handle both)
        geminiService.initialize(geminiApiKey || '', glmApiKey);
        
        // Test GLM connection
        const success = await geminiService.testConnection('glm');
        
        if (success) {
          setTestResult('success');
          setTestMessage('✅ GLM-4.6 connection successful! API key is valid.');
          
          // Save API key (encrypted) with global storage option
          await saveAPIKey('glm', glmApiKey, { saveGlobal: saveGlobally });
          setHasExistingGlmKey(true);
        } else {
          throw new Error('GLM connection test failed');
        }
      } catch (error: any) {
        console.error('GLM test connection error:', error);
        setTestResult('error');
        
        if (error.message?.includes('API_KEY_INVALID')) {
          setTestMessage('❌ Invalid GLM API key. Please check your key and try again.');
        } else if (error.message?.includes('RATE_LIMIT')) {
          setTestMessage('❌ GLM rate limit exceeded. Please wait and try again.');
        } else {
          setTestMessage(`❌ GLM connection failed: ${error.message || 'Unknown error'}`);
        }
      } finally {
        setTesting(false);
      }
    }
  };

  const handleSave = async () => {
    if (testResult === 'success') {
      // API key already saved during test connection, just trigger callbacks
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

  const handleRemove = async () => {
    const message = activeTab === 'gemini' 
      ? 'Are you sure you want to remove the Gemini API key from this device?\n\nNote: The key will still be available on other devices if saved globally.'
      : 'Are you sure you want to remove the GLM API key from this device?\n\nNote: The key will still be available on other devices if saved globally.';
    
    if (confirm(message)) {
      // Remove from localStorage only (keep in global storage)
      await removeAPIKey(activeTab, false);
      
      if (activeTab === 'gemini') {
        setGeminiApiKey('');
        setHasExistingGeminiKey(false);
      } else {
        setGlmApiKey('');
        setHasExistingGlmKey(false);
      }
      
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
            <h3 className="text-lg font-semibold text-gray-900">AI API Configuration</h3>
            <p className="text-sm text-gray-500">Configure AI API keys for image analysis and similarity comparison</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('gemini')}
          className={`flex-1 py-3 px-4 text-center font-medium border-b-2 transition-all ${
            activeTab === 'gemini'
              ? 'border-purple-600 text-purple-600 bg-purple-50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Key className="w-4 h-4" />
            <span>Google Gemini</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('glm')}
          className={`flex-1 py-3 px-4 text-center font-medium border-b-2 transition-all ${
            activeTab === 'glm'
              ? 'border-blue-600 text-blue-600 bg-blue-50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Cpu className="w-4 h-4" />
            <span>GLM-4.6 (Z.AI)</span>
          </div>
        </button>
      </div>

      {activeTab === 'gemini' ? (
        <>
          {/* Gemini Info Box */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-sm">
                <p className="text-blue-900 font-medium mb-1">Get your FREE Gemini API Key</p>
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

          {/* Gemini API Key Input */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gemini API Key {hasExistingGeminiKey && <span className="text-green-600">(Saved)</span>}
              </label>
              <div className="relative">
                <input
                  type={showGeminiApiKey ? 'text' : 'password'}
                  value={geminiApiKey}
                  onChange={(e) => {
                    setGeminiApiKey(e.target.value);
                    setTestResult(null);
                    setTestMessage('');
                  }}
                  placeholder="AIzaSy..."
                  className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiApiKey(!showGeminiApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showGeminiApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Your API key will be encrypted and stored securely in your browser.
              </p>
              
              {/* Global Storage Option */}
              <div className="mt-3 flex items-center">
                <input
                  type="checkbox"
                  id="save-globally-gemini"
                  checked={saveGlobally}
                  onChange={(e) => setSaveGlobally(e.target.checked)}
                  className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500 border-gray-300"
                />
                <label htmlFor="save-globally-gemini" className="ml-2 text-sm text-gray-700">
                  <span className="font-medium">Simpan untuk semua device</span>
                  <span className="text-gray-500 block text-xs mt-0.5">
                    API key akan disinkronisasi ke cloud sehingga bisa digunakan di HP, laptop, dll.
                  </span>
                </label>
              </div>
            </div>

            {/* Test Connection Button */}
            <div className="flex gap-3">
              <button
                onClick={handleTestConnection}
                disabled={!geminiApiKey || testing}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                  ${!geminiApiKey || testing
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

              {hasExistingGeminiKey && (
                <button
                  onClick={handleRemove}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-all"
                >
                  Remove Key
                </button>
              )}
            </div>

            {/* Test Result */}
            {testResult && activeTab === 'gemini' && (
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

          {/* Gemini Rate Limit Info */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">📊 Gemini Rate Limits (FREE Tier)</h4>
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
        </>
      ) : (
        <>
          {/* GLM Info Box */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-sm">
                <p className="text-blue-900 font-medium mb-1">Get GLM-4.6 API Key</p>
                <p className="text-blue-800 mb-2">
                  GLM-4.6 is a powerful multimodal AI model with excellent coding and analysis capabilities.
                  <br />
                  <span className="text-xs">Perfect backup when Gemini reaches rate limits</span>
                </p>
                <a
                  href="https://z.ai/model-api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Get API Key from Z.AI Platform
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          {/* GLM API Key Input */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GLM-4.6 API Key {hasExistingGlmKey && <span className="text-green-600">(Saved)</span>}
              </label>
              <div className="relative">
                <input
                  type={showGlmApiKey ? 'text' : 'password'}
                  value={glmApiKey}
                  onChange={(e) => {
                    setGlmApiKey(e.target.value);
                    setTestResult(null);
                    setTestMessage('');
                  }}
                  placeholder="sk-... or your Z.AI API key"
                  className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowGlmApiKey(!showGlmApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showGlmApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Your API key will be encrypted and stored securely in your browser.
              </p>
              
              {/* Global Storage Option */}
              <div className="mt-3 flex items-center">
                <input
                  type="checkbox"
                  id="save-globally-glm"
                  checked={saveGlobally}
                  onChange={(e) => setSaveGlobally(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="save-globally-glm" className="ml-2 text-sm text-gray-700">
                  <span className="font-medium">Simpan untuk semua device</span>
                  <span className="text-gray-500 block text-xs mt-0.5">
                    API key akan disinkronisasi ke cloud sehingga bisa digunakan di HP, laptop, dll.
                  </span>
                </label>
              </div>
            </div>

            {/* Test Connection Button */}
            <div className="flex gap-3">
              <button
                onClick={handleTestConnection}
                disabled={!glmApiKey || testing}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                  ${!glmApiKey || testing
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
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

              {hasExistingGlmKey && (
                <button
                  onClick={handleRemove}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-all"
                >
                  Remove Key
                </button>
              )}
            </div>

            {/* Test Result */}
            {testResult && activeTab === 'glm' && (
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

          {/* GLM Features Info */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">🚀 GLM-4.6 Features</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Automatic Fallback</p>
                  <p className="text-xs text-gray-600">System will automatically use GLM when Gemini reaches rate limits</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Cpu className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Multimodal Analysis</p>
                  <p className="text-xs text-gray-600">Excellent image understanding and similarity comparison</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Key className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">OpenAI-Compatible API</p>
                  <p className="text-xs text-gray-600">Uses standard OpenAI API format for easy integration</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              💡 System priority: Gemini first → GLM fallback when Gemini fails
            </p>
          </div>
        </>
      )}

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
