import { languages, DocumentFilter, ExtensionContext } from 'coc.nvim';

import ThriftDefineProvider from './DefineProvider';
import ThriftHoverProvider from './HoverProvider';
import ThriftCompletionItemProvider from './CompletionProvider';

export function activate(context: ExtensionContext) {
  const langMode: DocumentFilter[] = [{ scheme: 'file', language: 'thrift' }];
  context.logger.info('"thrift-syntax-support" is now active!');

  context.subscriptions.push(
    languages.registerDefinitionProvider(
      langMode,
      new ThriftDefineProvider()
    )
  );

  context.subscriptions.push(
    languages.registerHoverProvider(
      langMode,
      new ThriftHoverProvider(context.logger)
    )
  );
  
  context.subscriptions.push(
    languages.registerCompletionItemProvider(
      "coc-thrift-syntax-support",
      "coc-thrift-syntax-support",
      "thrift",
      new ThriftCompletionItemProvider(context.logger),
    )
  );
}
