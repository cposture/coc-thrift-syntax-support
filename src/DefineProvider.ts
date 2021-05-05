import { DefinitionProvider, TextDocument, Position, CancellationToken, Location, Uri, Range , workspace} from 'coc.nvim';
import {
  parse,
  SyntaxType,
  TextLocation,
} from '@creditkarma/thrift-parser';
import { genRange, ASTHelper, getFilePathFromDocument, genPosByShift} from './utils';

class ThriftDefineProvider implements DefinitionProvider {
  genLocation(loc: TextLocation, filePath: string) {
    return Promise.resolve(
      Location.create(
        Uri.file(filePath).toString(),
        genRange(loc)
      )
    );
  }

  provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Thenable<Location | null> {
    const doc = workspace.getDocument(document.uri)
    const wordRange = doc.getWordRangeAtPosition(position);
    const word = document.getText(wordRange);
    let prevWord = '';
    const leftCharacter = document.getText(
      Range.create(
        genPosByShift(wordRange.start, -1),
        wordRange.start)
    );
    if (leftCharacter && leftCharacter === '.') {
      const prevWordRange = doc.getWordRangeAtPosition(
        genPosByShift(wordRange.start, -2)
      );
      prevWord = document.getText(prevWordRange);
    }
    const rawFile = document.getText();
    const processor = (raw: string, filePath: string): Thenable<Location | null> => {
      const thriftParseResult = parse(raw);
      if (thriftParseResult.type !== SyntaxType.ThriftDocument) {
        return Promise.resolve(null);
      }
      const astHelper = new ASTHelper(thriftParseResult, document);
      const wordNode = astHelper.findNodeByWord(word);
      const prevWordNode = astHelper.findNodeByWord(prevWord);
      const includeNodeList = astHelper.includeNodes;
      /**
       * If prev word is an enum define, jump to the enum member defined position.
       * e.g. Worker.ENGINEER -> jump to the ENGINEER defined line
       */
      if (prevWordNode && prevWordNode.type === 'EnumDefinition') {
        const enumNumber = prevWordNode.members.find(item => item.name.value === word);
        if (enumNumber) {
          return this.genLocation(enumNumber.name.loc, filePath);
        }
      }
      // if focus on thrift file name, redirect to this thrift file.
      const pathItem = includeNodeList.find(item => item.fileName === word);
      if (pathItem) {
        return Promise.resolve(
          Location.create(
            Uri.file(pathItem.filePath).toString(),
            Range.create(0, 0, 0, 0)
          )
        );
      }
      // if can find focused word in this file, autojump
      if (wordNode) return this.genLocation(wordNode.name.loc, filePath);
      const includeNode = includeNodeList.find(item => {
        return item.raw.indexOf(word) > -1;
      });
      if (includeNode) {
        const { raw, filePath } = includeNode;
        return processor(raw, filePath);
      }
      return Promise.resolve(null);
    };
    return processor(rawFile, getFilePathFromDocument(document));
  }
}

export default ThriftDefineProvider;
