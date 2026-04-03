'use client';

import type { Monaco } from '@monaco-editor/react';

type SupportedLanguage = 'javascript' | 'typescript' | 'python' | 'java' | 'cpp';

interface SnippetDefinition {
  label: string;
  detail: string;
  documentation: string;
  insertText: string;
  aliases?: string[];
}

const snippet = (
  label: string,
  detail: string,
  documentation: string,
  insertText: string,
  aliases: string[] = [],
): SnippetDefinition => ({
  label,
  detail,
  documentation,
  insertText,
  aliases,
});

const LANGUAGE_SNIPPETS: Record<SupportedLanguage, SnippetDefinition[]> = {
  javascript: [
    snippet('log', 'console.log', 'Insert a console.log statement.', 'console.log(${1:value});', ['clg', 'print']),
    snippet('fn', 'function', 'Insert a function declaration.', 'function ${1:name}(${2:params}) {\n\t${0}\n}', ['function']),
    snippet('afn', 'arrow function', 'Insert an arrow function.', 'const ${1:name} = (${2:params}) => {\n\t${0}\n};', ['arrow', 'arrowfn']),
    snippet('if', 'if statement', 'Insert an if block.', 'if (${1:condition}) {\n\t${0}\n}'),
    snippet('ifelse', 'if / else', 'Insert an if / else block.', 'if (${1:condition}) {\n\t${2}\n} else {\n\t${0}\n}', ['else']),
    snippet('fori', 'for loop', 'Insert an index-based for loop.', 'for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\t${0}\n}', ['for']),
    snippet('forof', 'for...of loop', 'Insert a for...of loop.', 'for (const ${1:item} of ${2:items}) {\n\t${0}\n}', ['foreach']),
    snippet('while', 'while loop', 'Insert a while loop.', 'while (${1:condition}) {\n\t${0}\n}'),
    snippet('trycatch', 'try / catch', 'Insert a try / catch block.', 'try {\n\t${1}\n} catch (${2:error}) {\n\t${0}\n}', ['try']),
    snippet('asyncfn', 'async function', 'Insert an async function.', 'async function ${1:name}(${2:params}) {\n\t${0}\n}', ['async']),
    snippet('fetch', 'fetch call', 'Insert a fetch request.', "const response = await fetch('${1:/api/path}', {\n\tmethod: '${2:GET}',\n\theaders: {\n\t\t'Content-Type': 'application/json',\n\t},\n});\n\nconst data = await response.json();\n${0}", ['api']),
    snippet('settimeout', 'setTimeout', 'Insert a setTimeout call.', 'setTimeout(() => {\n\t${0}\n}, ${1:1000});', ['timeout']),
    snippet('promise', 'Promise', 'Insert a Promise wrapper.', 'return new Promise((${1:resolve}, ${2:reject}) => {\n\t${0}\n});'),
    snippet('class', 'class', 'Insert a class declaration.', 'class ${1:ClassName} {\n\tconstructor(${2:params}) {\n\t\t${0}\n\t}\n}'),
  ],
  typescript: [
    snippet('log', 'console.log', 'Insert a console.log statement.', 'console.log(${1:value});', ['clg', 'print']),
    snippet('fn', 'typed function', 'Insert a typed function declaration.', 'function ${1:name}(${2:params}): ${3:void} {\n\t${0}\n}', ['function']),
    snippet('afn', 'typed arrow function', 'Insert a typed arrow function.', 'const ${1:name} = (${2:params}): ${3:void} => {\n\t${0}\n};', ['arrow', 'arrowfn']),
    snippet('interface', 'interface', 'Insert an interface definition.', 'interface ${1:Name} {\n\t${0}\n}', ['intf']),
    snippet('type', 'type alias', 'Insert a type alias.', 'type ${1:Name} = {\n\t${0}\n};'),
    snippet('enum', 'enum', 'Insert an enum definition.', 'enum ${1:Name} {\n\t${0}\n}'),
    snippet('if', 'if statement', 'Insert an if block.', 'if (${1:condition}) {\n\t${0}\n}'),
    snippet('ifelse', 'if / else', 'Insert an if / else block.', 'if (${1:condition}) {\n\t${2}\n} else {\n\t${0}\n}', ['else']),
    snippet('fori', 'for loop', 'Insert an index-based for loop.', 'for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\t${0}\n}', ['for']),
    snippet('trycatch', 'try / catch', 'Insert a try / catch block.', 'try {\n\t${1}\n} catch (${2:error}) {\n\t${0}\n}', ['try']),
    snippet('asyncfn', 'async function', 'Insert an async typed function.', 'async function ${1:name}(${2:params}): Promise<${3:void}> {\n\t${0}\n}', ['async']),
    snippet('class', 'class', 'Insert a class declaration.', 'class ${1:ClassName} {\n\tconstructor(${2:params}) {\n\t\t${0}\n\t}\n}'),
    snippet('promise', 'Promise', 'Insert a Promise wrapper.', 'return new Promise<${1:void}>((${2:resolve}, ${3:reject}) => {\n\t${0}\n});'),
    snippet('guard', 'type guard', 'Insert a type guard function.', 'function ${1:isType}(value: unknown): value is ${2:Type} {\n\t${0:return false;}\n}', ['typeguard']),
  ],
  python: [
    snippet('print', 'print', 'Insert a print statement.', 'print(${1:value})', ['pr']),
    snippet('def', 'function', 'Insert a function definition.', 'def ${1:name}(${2:args}):\n\t${0:pass}', ['function']),
    snippet('class', 'class', 'Insert a class definition.', 'class ${1:ClassName}:\n\tdef __init__(self${2:, value}):\n\t\t${0:pass}'),
    snippet('if', 'if statement', 'Insert an if block.', 'if ${1:condition}:\n\t${0:pass}'),
    snippet('ifelse', 'if / else', 'Insert an if / else block.', 'if ${1:condition}:\n\t${2:pass}\nelse:\n\t${0:pass}', ['else']),
    snippet('forin', 'for loop', 'Insert a for loop.', 'for ${1:item} in ${2:items}:\n\t${0:pass}', ['for']),
    snippet('while', 'while loop', 'Insert a while loop.', 'while ${1:condition}:\n\t${0:pass}'),
    snippet('try', 'try / except', 'Insert a try / except block.', 'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:error}:\n\t${0:pass}', ['tryexcept']),
    snippet('ifmain', 'if __name__ == "__main__"', 'Insert the main guard.', 'if __name__ == "__main__":\n\t${0:pass}', ['main']),
    snippet('with', 'with block', 'Insert a with block.', 'with ${1:open(${2:"file.txt"}, ${3:"r"})} as ${4:file}:\n\t${0:pass}'),
    snippet('listcomp', 'list comprehension', 'Insert a list comprehension.', '[${1:item} for ${2:item} in ${3:items}]', ['lc']),
    snippet('dictcomp', 'dict comprehension', 'Insert a dict comprehension.', '{${1:key}: ${2:value} for ${3:key}, ${4:value} in ${5:items}}', ['dc']),
    snippet('input', 'input', 'Insert an input read.', '${1:value} = input(${2:""})', ['inp']),
    snippet('enumerate', 'enumerate loop', 'Insert an enumerate loop.', 'for ${1:index}, ${2:item} in enumerate(${3:items}):\n\t${0:pass}', ['enum']),
  ],
  java: [
    snippet('sout', 'System.out.println', 'Insert System.out.println().', 'System.out.println(${1:value});', ['print']),
    snippet('Scanner', 'Scanner input', 'Insert a Scanner variable.', 'Scanner ${1:scanner} = new Scanner(System.in);\n${0}', ['scanner', 'scn', 'scan']),
    snippet('psvm', 'public static void main', 'Insert the main method.', 'public static void main(String[] args) {\n\t${0}\n}', ['main']),
    snippet('method', 'method', 'Insert a method.', 'public static ${1:void} ${2:name}(${3}) {\n\t${0}\n}', ['func']),
    snippet('fori', 'for loop', 'Insert an index-based for loop.', 'for (int ${1:i} = 0; ${1:i} < ${2:arr}.length; ${1:i}++) {\n\t${0}\n}', ['for']),
    snippet('foreach', 'enhanced for loop', 'Insert an enhanced for loop.', 'for (${1:int} ${2:item} : ${3:items}) {\n\t${0}\n}', ['forEach']),
    snippet('if', 'if statement', 'Insert an if block.', 'if (${1:condition}) {\n\t${0}\n}'),
    snippet('ifelse', 'if / else', 'Insert an if / else block.', 'if (${1:condition}) {\n\t${2}\n} else {\n\t${0}\n}', ['else']),
    snippet('while', 'while loop', 'Insert a while loop.', 'while (${1:condition}) {\n\t${0}\n}'),
    snippet('trycatch', 'try / catch', 'Insert a try / catch block.', 'try {\n\t${1}\n} catch (${2:Exception} ${3:e}) {\n\t${0}\n}', ['try']),
    snippet('class', 'class', 'Insert a class declaration.', 'class ${1:Main} {\n\t${0}\n}'),
    snippet('ArrayList', 'ArrayList', 'Insert an ArrayList declaration.', 'ArrayList<${1:Integer}> ${2:list} = new ArrayList<>();\n${0}', ['arraylist', 'arrlist']),
    snippet('HashMap', 'HashMap', 'Insert a HashMap declaration.', 'HashMap<${1:Integer}, ${2:Integer}> ${3:map} = new HashMap<>();\n${0}', ['hashmap', 'map']),
    snippet('Arrays.sort', 'Arrays.sort', 'Insert Arrays.sort.', 'Arrays.sort(${1:arr});\n${0}', ['sort']),
  ],
  cpp: [
    snippet('cout', 'std::cout', 'Insert a std::cout statement.', 'std::cout << ${1:value} << std::endl;', ['print']),
    snippet('cin', 'std::cin', 'Insert a std::cin statement.', 'std::cin >> ${1:value};', ['input']),
    snippet('main', 'main function', 'Insert the main function.', 'int main() {\n\t${0}\n\treturn 0;\n}', ['intmain']),
    snippet('fori', 'for loop', 'Insert an index-based for loop.', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n\t${0}\n}', ['for']),
    snippet('forr', 'reverse for loop', 'Insert a reverse for loop.', 'for (int ${1:i} = ${2:n} - 1; ${1:i} >= 0; --${1:i}) {\n\t${0}\n}', ['revfor']),
    snippet('if', 'if statement', 'Insert an if block.', 'if (${1:condition}) {\n\t${0}\n}'),
    snippet('ifelse', 'if / else', 'Insert an if / else block.', 'if (${1:condition}) {\n\t${2}\n} else {\n\t${0}\n}', ['else']),
    snippet('while', 'while loop', 'Insert a while loop.', 'while (${1:condition}) {\n\t${0}\n}'),
    snippet('vector', 'std::vector', 'Insert a vector declaration.', 'std::vector<${1:int}> ${2:values};\n${0}', ['vec']),
    snippet('pair', 'std::pair', 'Insert a pair declaration.', 'std::pair<${1:int}, ${2:int}> ${3:value};\n${0}'),
    snippet('fastio', 'fast I/O', 'Insert fast I/O setup.', 'std::ios::sync_with_stdio(false);\nstd::cin.tie(nullptr);\n${0}', ['ios']),
    snippet('sort', 'std::sort', 'Insert std::sort.', 'std::sort(${1:values}.begin(), ${1:values}.end());\n${0}'),
    snippet('bits', '#include <bits/stdc++.h>', 'Insert the competitive programming include.', '#include <bits/stdc++.h>\nusing namespace std;\n\n${0}', ['include']),
  ],
};

type GlobalSnippetRegistry = typeof globalThis & {
  __codelinkSnippetProvidersRegistered?: boolean;
};

function buildFilterText(snippetDefinition: SnippetDefinition) {
  return [snippetDefinition.label, ...(snippetDefinition.aliases ?? [])].join(' ');
}

export function registerEditorSnippets(monaco: Monaco) {
  const snippetRegistry = globalThis as GlobalSnippetRegistry;

  if (snippetRegistry.__codelinkSnippetProvidersRegistered) {
    return;
  }

  Object.entries(LANGUAGE_SNIPPETS).forEach(([language, snippets]) => {
    monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        return {
          suggestions: snippets.map((snippetDefinition, index) => ({
            label: snippetDefinition.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: snippetDefinition.detail,
            documentation: snippetDefinition.documentation,
            insertText: snippetDefinition.insertText,
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
            sortText: `00${index.toString().padStart(2, '0')}`,
            filterText: buildFilterText(snippetDefinition),
          })),
        };
      },
    });
  });

  snippetRegistry.__codelinkSnippetProvidersRegistered = true;
}
