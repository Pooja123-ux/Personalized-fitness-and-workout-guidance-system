"""
Fix chatbot_logic.py formatting issues
"""

import re

def fix_chatbot_file():
    try:
        # Read the corrupted file
        with open('app/chatbot_logic.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Fix the docstring first
        content = content.replace('"""DynamicIntelligentFitnessChatbotLogicwithLLaMA3IntegrationCananswerANYquestionaboutANYattributeinANYdatasetwithouthardcodedpatternsEnhancedwithMetaAILLaMA3viaOllamaforintelligentresponses"""', 
                                 '"""\nDynamic Intelligent Fitness Chatbot Logic with LLaMA 3 Integration\nCan answer ANY question about ANY attribute in ANY dataset without hardcoded patterns\nEnhanced with Meta AI LLaMA 3 via Ollama for intelligent responses\n"""')
        
        # Add proper line breaks after imports and class definitions
        content = re.sub(r'"""import', '"""\n\nimport', content)
        content = re.sub(r'pdimport', 'pd\nimport', content)
        content = re.sub(r'reimport', 're\nimport', content)
        content = re.sub(r'jsonimport', 'json\nimport', content)
        content = re.sub(r'Dictimport', 'Dict\nimport', content)
        content = re.sub(r'Listimport', 'List\nimport', content)
        content = re.sub(r'Anyimport', 'Any\nimport', content)
        content = re.sub(r'Optionalimport', 'Optional\nimport', content)
        content = re.sub(r'Tupleimport', 'Tuple\nimport', content)
        content = re.sub(r'Unionimport', 'Union\nimport', content)
        content = re.sub(r'npimport', 'np\nimport', content)
        content = re.sub(r'datetimeimport', 'datetime\nimport', content)
        content = re.sub(r'requestsimport', 'requests\nimport', content)
        content = re.sub(r'asyncioimport', 'asyncio\nimport', content)
        
        # Fix class definition
        content = re.sub(r'asyncioclassFitnessChatbot', 'asyncio\n\nclass FitnessChatbot', content)
        
        # Fix method definitions
        content = re.sub(r'def__init__', '\n    def __init__', content)
        content = re.sub(r'deftest_ollama_connection', '\n    def test_ollama_connection', content)
        content = re.sub(r'defcall_llama3', '\n    def call_llama3', content)
        
        # Fix basic formatting issues
        content = re.sub(r'selfuse_llama=use_llama', 'self.use_llama = use_llama', content)
        content = re.sub(r'selfollama_url=ollama_url', 'self.ollama_url = ollama_url', content)
        content = re.sub(r'selfllama_model="llama3"', 'self.llama_model = "llama3"', content)
        content = re.sub(r'selfdatasets={}', 'self.datasets = {}', content)
        content = re.sub(r'selfdataset_metadata={}', 'self.dataset_metadata = {}', content)
        
        # Write the fixed content back
        with open('app/chatbot_logic.py', 'w', encoding='utf-8') as f:
            f.write(content)
        
        print('✅ Fixed chatbot_logic.py formatting issues')
        return True
        
    except Exception as e:
        print(f'❌ Error fixing file: {e}')
        return False

if __name__ == "__main__":
    fix_chatbot_file()
