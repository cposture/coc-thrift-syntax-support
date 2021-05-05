import { CompletionItemProvider, TextDocument, Position, CancellationToken, CompletionItem, CompletionItemKind, workspace, ExtensionContext, Range, Document} from 'coc.nvim';
import * as fs from 'fs';
import { ASTHelper, getFilePathFromDocument, genPosByShift } from './utils';
import { parse, SyntaxType } from '@creditkarma/thrift-parser';

// const { StructDefinition,  EnumDefinition, ConstDefinition, ExceptionDefinition, IncludeDefinition } = SyntaxType;

export enum CustomeSyntaxKind {
  StructDefinition = CompletionItemKind.Struct,
  EnumDefinition = CompletionItemKind.Enum,
  ConstDefinition = CompletionItemKind.Constant,
  ExceptionDefinition = CompletionItemKind.Property,
  IncludeDefinition = CompletionItemKind.Module,
  NamespaceDefinition = CompletionItemKind.Unit,
  TypedefDefinition = CompletionItemKind.Reference,
  ServiceDefinition = CompletionItemKind.Reference,
}

const keyWords = [
  'include',
  'cpp_include',
  'namespace',
  'const',
  'typedef',
  'enum',
  'struct',
  'union',
  'exception',
  'extends',
  'service',
  'required',
  'optional',
  'oneway',
  'void',
  'throws',
  'bool',
  'byte',
  'i8',
  'i16',
  'i32',
  'i64',
  'double',
  'string',
  'binary',
  'slist',
  'map',
  'set',
  'list',
  'cpp_type'
];

const keywords2CompletionItem = () =>
  keyWords.map(item => { 
    return {
        label: item,
        kind: CompletionItemKind.Keyword,
        sortText: "falsy",
    } as CompletionItem
});

class ThriftCompletionItemProvider implements CompletionItemProvider {
  private logger: ExtensionContext["logger"];

  public constructor(logger: ExtensionContext["logger"]) {
    this.logger = logger;
  }

  private getPreWord(document: TextDocument, doc: Document, lineNum: number, wordRange?: Range): string {
    let prevWord = ""
    let items = doc.getline(lineNum).split(".")
    if (!wordRange || items.length == 2 && items[0].length < wordRange.start.character) {
        prevWord = document.getText(doc.getWordRangeAtPosition(Position.create(lineNum, items[0].length-1)))
    }
    return prevWord
  }

  provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken):Thenable<CompletionItem[]> {
    this.logger.info(`provideCompletionItems req uri:${JSON.stringify(document.uri)}, position:${JSON.stringify(position)}`)
    const doc = workspace.getDocument(document.uri)
    const wordPosition = Position.create(position.line, position.character - 1)
    const wordRange = doc.getWordRangeAtPosition(wordPosition)
    this.logger.info("wordRange:" + JSON.stringify(wordRange))
    let word = ""
    if (wordRange) {
       word = document.getText(wordRange).split(/\r?\n/)[0];
    } 
    this.logger.info("word:" + JSON.stringify(word))
    let prevWord = this.getPreWord(document, doc, position.line, wordRange);
    this.logger.info("prevWord:" + JSON.stringify(prevWord))
    let raw = '';
    try {
      raw = fs.readFileSync(getFilePathFromDocument(document), { encoding: 'utf8' });
    // eslint-disable-next-line no-empty
    } catch (error) {
        this.logger.error("readFileSync err:" + JSON.stringify(error))
    }

    const processor = (raw: string, prevWord: string, filePath: string): Thenable<CompletionItem[] | null> => {
      const thriftParseResult = parse(raw);
      if (thriftParseResult.type !== SyntaxType.ThriftDocument) {
        this.logger.error("parse thrift failed, err:" + JSON.stringify(thriftParseResult))
        return Promise.resolve(null);
      }
      const astHelper = new ASTHelper(thriftParseResult, document);
      if (prevWord === '') {
        const completionItems: CompletionItem[] = [];
        const wordNodes = astHelper.findNodesByInput(word);
        this.logger.info("test123" + word)
        wordNodes.forEach(item => {
          completionItems.push(
              {label: item.name.value, kind: CustomeSyntaxKind[item.type], sortText: "falsy"} as CompletionItem
          );
        });
        return completionItems
      }
      const includeNodeList = astHelper.includeNodes;
      // if can find focused word in this file, autojump
      const includeNode = includeNodeList.find(item => {
        this.logger.info("item:" + JSON.stringify(item.fileName))
        return item.fileName === prevWord
      });
      if (includeNode) {
        const { raw, filePath } = includeNode;
        return processor(raw, '', filePath);
      }
      this.logger.info("no completionItems")
      return Promise.resolve(null);
    };

    const that = this
    return new Promise(function (resolve, reject) {
      Promise.all([
        keywords2CompletionItem(),
        processor(raw, prevWord, getFilePathFromDocument(document)),
      ])
        .then(function (results) {
          const suggestions = Array.prototype.concat.apply([], results);
          resolve(suggestions);
        })
        .catch(err => { reject(err); });
    });
  }
}

export default ThriftCompletionItemProvider;
