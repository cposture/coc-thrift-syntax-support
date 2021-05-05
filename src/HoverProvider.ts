import { HoverProvider, TextDocument, Position, Hover, workspace, Uri, MarkupContent, ExtensionContext } from 'coc.nvim';
import { parse, SyntaxType } from '@creditkarma/thrift-parser';
import { ASTHelper } from './utils';

const { openTextDocument } = workspace;

class ThriftHoverProvider implements HoverProvider {
  private logger: ExtensionContext["logger"];

  public constructor(logger: ExtensionContext["logger"]) {
    this.logger = logger;
  }

  provideHover(document: TextDocument, position: Position): Thenable<Hover | null> {
    this.logger.info(`provideHover req uri:${JSON.stringify(document.uri)}, position:${JSON.stringify(position)}`)
    const doc = workspace.getDocument(document.uri)
    const word = document.getText(doc.getWordRangeAtPosition(position));
    const rawFile = document.getText();
    const processor = (rawText: string, doc: TextDocument): Thenable<Hover | null> => {
      const thriftParseResult = parse(rawText);
      this.logger.info("parse result:" + JSON.stringify(thriftParseResult))
      if (thriftParseResult.type === SyntaxType.ThriftDocument) {
        const helper = new ASTHelper(thriftParseResult, doc);
        const wordNode = helper.findNodeByWord(word);
        const { includeNodes } = helper;
        if (wordNode) {
            let comment: string[] = []
            wordNode.comments.forEach((val, index, array) => {
                if (val.type === SyntaxType.CommentBlock) {
                    comment = comment.concat(val.value)
                } else if (val.type === SyntaxType.CommentLine) {
                    comment.push(val.value)
                }
            })
            comment.forEach((val, index, array) => { array[index] = val.trimLeft()})
            return Promise.resolve({contents: {kind: 'markdown', value: [
                `(${wordNode.type}) **${wordNode.name.value}**`,
                ...comment,
            ].join("\n")} as MarkupContent} as Hover)
        }
        const includeNode = includeNodes.find(item => {
          return item.raw.indexOf(word) > -1;
        });
        if (includeNode) {
          const { filePath, raw } = includeNode;
          let iDoc = workspace.getDocument(filePath)
          return processor(raw, iDoc);
        }
      }
      return Promise.resolve(null);
    };
    return processor(rawFile, document);
  }
}

export default ThriftHoverProvider;
