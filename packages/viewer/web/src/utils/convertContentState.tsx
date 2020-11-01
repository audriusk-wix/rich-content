import React from 'react';

import {
  BLOCK_TYPES,
  depthClassName,
  getTextDirection,
  getDirectionFromAlignmentAndTextDirection,
  RicosContent,
  TextDirection,
  PluginMapping,
  ViewerContextType,
  Decorator,
  PluginTypeMapper,
  LegacyPluginConfig,
  InlineStyleMapper,
} from 'wix-rich-content-common';
import { getBlockIndex } from './draftUtils';
import redraft from 'wix-redraft';
import classNames from 'classnames';
import { endsWith } from 'lodash';
import List from '../List';
import { isPaywallSeo, getPaywallSeoClass } from './paywallSeo';
import getPluginViewers from '../getPluginViewers';
import { kebabToCamelObjectKeys, hasText } from './textUtils';
import { staticInlineStyleMapper } from '../staticInlineStyleMapper';
import { combineMappers } from './combineMappers';
import { getInteractionWrapper, DefaultInteractionWrapper } from './getInteractionWrapper';
import Anchor from '../components/Anchor';
import styles from '../../statics/rich-content-viewer.scss';

const isEmptyContentState = (raw?: RicosContent) =>
  !raw ||
  !raw.blocks ||
  (raw.blocks.length === 1 && raw.blocks[0].text === '' && raw.blocks[0].type === 'unstyled');

const isEmptyBlock = ([_, data]) => data && data.length === 0; //eslint-disable-line no-unused-vars

const getBlockDepth = (contentState, key) =>
  contentState.blocks.find(block => block.key === key).depth || 0;

const getBlockStyleClasses = (
  mergedStyles: Record<string, string>,
  textDirection: TextDirection,
  textAlignment: 'left' | 'right',
  classes?: string,
  isListItem?: boolean
) => {
  const rtl = textDirection === 'rtl';
  const defaultTextAlignment = rtl ? 'right' : 'left';
  const languageDirection = textDirection || 'ltr';
  const alignmentClass = textAlignment || defaultTextAlignment;
  const directionRTL = isListItem ? rtl : languageDirection !== 'ltr';
  const directionClass = directionRTL ? mergedStyles.rtl : mergedStyles.ltr;

  return classNames(classes, directionClass, mergedStyles[alignmentClass]);
};

let blockCount = 0;

const blockDataToStyle = ({ dynamicStyles }) => kebabToCamelObjectKeys(dynamicStyles);

const getInline = (inlineStyleMappers, mergedStyles) =>
  combineMappers([...inlineStyleMappers, staticInlineStyleMapper], mergedStyles);

const getBlocks = (mergedStyles, textDirection, context, addAnchorsPrefix) => {
  const getList = ordered => (items, blockProps) => {
    const fixedItems = items.map(item => (item.length ? item : [' ']));

    const props = {
      key: blockProps.keys[0],
      items: fixedItems,
      ordered,
      mergedStyles,
      textDirection,
      blockProps,
      getBlockStyleClasses,
      blockDataToStyle,
      getBlockDepth,
      context,
    };
    return <List {...props} />;
  };

  const blockFactory = (type, style) => {
    return (children, blockProps) =>
      children.map((child, i) => {
        const alignment = blockProps.data[i]?.textAlignment || context.textAlignment;
        const depth = getBlockDepth(context.contentState, blockProps.keys[i]);
        const blockDirection = getDirectionFromAlignmentAndTextDirection(
          alignment,
          textDirection || blockProps.data[i]?.textDirection
        );

        const hasJustifyText = alignment === 'justify' && hasText(child);
        const directionBlockClassName = `public-DraftStyleDefault-text-${blockDirection}`;
        const directionTextClassName = `public-DraftStyleDefault-${textDirection ||
          blockProps.data[i]?.textDirection ||
          'ltr'}`;

        const ChildTag = typeof type === 'string' ? type : type(child);
        const blockIndex = getBlockIndex(context.contentState, blockProps.keys[i]);
        const { interactions } = blockProps.data[i];
        const BlockWrapper = Array.isArray(interactions)
          ? getInteractionWrapper({ interactions, context })
          : DefaultInteractionWrapper;

        const _child = isEmptyBlock(child) ? <br /> : child;

        const inner = (
          <ChildTag
            id={`viewer-${blockProps.keys[i]}`}
            className={classNames(
              getBlockStyleClasses(
                mergedStyles,
                textDirection || blockProps.data[i]?.textDirection,
                alignment,
                mergedStyles[style]
              ),
              hasJustifyText && styles.hasJustifyText,
              depthClassName(depth),
              directionBlockClassName,
              isPaywallSeo(context.seoMode) &&
                getPaywallSeoClass(context.seoMode.paywall, blockIndex)
            )}
            style={blockDataToStyle(blockProps.data[i])}
            key={blockProps.keys[i]}
          >
            <span className={classNames(styles.child, directionTextClassName)}>{_child}</span>
          </ChildTag>
        );

        const blockWrapper = (
          <BlockWrapper key={`${blockProps.keys[i]}_wrap`}>{inner}</BlockWrapper>
        );

        const shouldAddAnchors = addAnchorsPrefix && !isEmptyBlock(child);
        let resultBlock = blockWrapper;

        if (shouldAddAnchors) {
          blockCount++;
          const anchorKey = `${addAnchorsPrefix}${blockCount}`;
          resultBlock = (
            <React.Fragment key={`${blockProps.keys[i]}_wrap`}>
              {blockWrapper}
              <Anchor
                type={typeof type === 'string' ? type : 'paragraph'}
                key={anchorKey}
                anchorKey={anchorKey}
              />
            </React.Fragment>
          );
        }

        return resultBlock;
      });
  };

  return {
    unstyled: blockFactory(child => (isEmptyBlock(child) ? 'div' : 'p'), 'text'),
    blockquote: blockFactory('blockquote', 'quote'),
    'header-one': blockFactory('h1', 'headerOne'),
    'header-two': blockFactory('h2', 'headerTwo'),
    'header-three': blockFactory('h3', 'headerThree'),
    'header-four': blockFactory('h4', 'headerFour'),
    'header-five': blockFactory('h5', 'headerFive'),
    'header-six': blockFactory('h6', 'headerSix'),
    'code-block': blockFactory('pre', 'codeBlock'),
    'unordered-list-item': getList(false),
    'ordered-list-item': getList(true),
  };
};

const getEntities = (typeMappers, context, styles, addAnchorsPrefix, innerRCEViewerProps) => {
  const emojiViewerFn = (emojiUnicode, data, { key }) => {
    return (
      <span key={key} style={{ fontFamily: 'cursive' }}>
        {emojiUnicode}
      </span>
    );
  };

  return {
    EMOJI_TYPE: emojiViewerFn,
    ...getPluginViewers(
      typeMappers,
      context,
      styles,
      type => {
        if (addAnchorsPrefix) {
          blockCount++;
          const anchorKey = `${addAnchorsPrefix}${blockCount}`;
          return <Anchor type={type} key={anchorKey} anchorKey={anchorKey} />;
        } else {
          return null;
        }
      },
      innerRCEViewerProps
    ),
  };
};

const normalizeContentState = (contentState: RicosContent): RicosContent => ({
  ...contentState,
  blocks: contentState.blocks.map(block => {
    if (block.type === 'atomic') {
      return block;
    }

    const data = { ...block.data };
    const direction = getTextDirection(block.text);
    if (direction === 'rtl') {
      data.textDirection = direction;
    }

    let text = block.text;
    if (endsWith(text, '\n')) {
      text += '\n';
    }

    return {
      ...block,
      depth: 0,
      data,
      text,
    };
  }),
});

const redraftOptions = {
  cleanup: {
    after: BLOCK_TYPES.filter(t => t.indexOf('header') === -1),
    split: true,
    except: [
      'unordered-list-item',
      'ordered-list-item',
      'unstyled',
      'header-one',
      'header-two',
      'header-three',
      'header-four',
      'header-five',
      'header-six',
    ],
  },
  convertFromRaw: contentState => contentState,
};

const convertToReact = (
  mergedStyles: Record<string, string>,
  textDirection: TextDirection | undefined,
  typeMappers: PluginMapping,
  context: ViewerContextType,
  decorators: Decorator[],
  inlineStyleMappers: InlineStyleMapper[],
  initSpoilers: (content?: RicosContent) => RicosContent | undefined,
  options: { addAnchors?: boolean | string; [key: string]: unknown } = {},
  innerRCEViewerProps?: {
    typeMappers: PluginTypeMapper[];
    inlineStyleMappers: InlineStyleMapper[];
    decorators: Decorator[];
    config: LegacyPluginConfig;
  }
) => {
  if (isEmptyContentState(context.contentState)) {
    return null;
  }
  const { addAnchors, ...restOptions } = options;
  const normalizedContentState = context.contentState
    ? normalizeContentState(context.contentState)
    : context.contentState;
  const newContentState = initSpoilers
    ? initSpoilers(normalizedContentState)
    : normalizedContentState;

  const addAnchorsPrefix = addAnchors && (addAnchors === true ? 'rcv-block' : addAnchors);
  blockCount = 0;
  return redraft(
    newContentState,
    {
      inline: getInline(inlineStyleMappers, mergedStyles),
      blocks: getBlocks(mergedStyles, textDirection, context, addAnchorsPrefix),
      entities: getEntities(
        typeMappers,
        context,
        mergedStyles,
        addAnchorsPrefix,
        innerRCEViewerProps
      ),
      decorators,
    },
    { ...redraftOptions, ...restOptions }
  );
};

// renderToStaticMarkup param should be imported 'react-dom/server' (in order reduce viewer bundle size and probably not used anyhow)
const convertToHTML = (
  contentState,
  mergedStyles,
  textDirection,
  typeMap,
  entityProps,
  decorators,
  renderToStaticMarkup,
  options
) => {
  if (isEmptyContentState(contentState)) {
    return null;
  }

  blockCount = 0;
  const reactOutput = convertToReact(
    contentState,
    mergedStyles,
    textDirection,
    typeMap,
    entityProps,
    decorators,
    options
  );

  return reactOutput.reduce((html, blocks) => {
    const blocksArr = blocks instanceof Array ? blocks : [blocks];
    blocksArr.forEach(c => (html += renderToStaticMarkup(c))); //eslint-disable-line no-param-reassign
    return html;
  }, '');
};

export { convertToReact, convertToHTML };