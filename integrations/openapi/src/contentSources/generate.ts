import type { ContentRefOpenAPI } from '@gitbook/api';
import {
    type ContentSourceDependenciesValueFromRef,
    ContentSourceInput,
    createContentSource,
    ExposableError,
} from '@gitbook/runtime';
import { assertNever } from '../utils';
import type { OpenAPIRuntimeContext } from '../types';
import { getLatestOpenAPISpecContent, getAllOpenAPIPages } from '../parser/spec';
import { getRevisionFromSpec } from '../parser/revision';
import { getOpenAPIPageDocument } from '../parser/page';
import { getModelsDocument } from '../parser/models';

export type OpenAPIContentSource = ContentSourceInput<
    {
        /**
         * Should a models page be generated?
         * @default true
         */
        models?: boolean;
    },
    {
        spec: {
            ref: ContentRefOpenAPI;
        };
    }
>;

export type GenerateOperationsPageProps = {
    doc: 'operations';
    page: string;
};

type GenerateModelsPageProps = {
    doc: 'models';
};

type GetPageDocumentProps = GenerateOperationsPageProps | GenerateModelsPageProps;

/**
 * Content source to generate pages from an OpenAPI specification.
 */
export const generateContentSource = createContentSource<
    OpenAPIContentSource['props'],
    GetPageDocumentProps,
    OpenAPIContentSource['dependencies']
>({
    sourceId: 'generate',

    getRevision: async ({ props, dependencies }, ctx) => {
        const specContent = await getOpenAPISpecFromDependencies(dependencies, ctx);
        return getRevisionFromSpec({ specContent, props });
    },

    getPageDocument: async ({ props, dependencies }, ctx) => {
        switch (props.doc) {
            case 'operations':
                return generateOperationsDocument({ props, dependencies }, ctx);
            case 'models':
                return generateModelsDocument({ props, dependencies }, ctx);
            default:
                assertNever(props);
        }
    },
});

/**
 * Generate a document for a group in the OpenAPI specification.
 */
async function generateOperationsDocument(
    input: ContentSourceInput<GenerateOperationsPageProps, OpenAPIContentSource['dependencies']>,
    ctx: OpenAPIRuntimeContext,
) {
    const { props, dependencies } = input;
    const spec = await getOpenAPISpecFromDependencies(dependencies, ctx);
    const pages = getAllOpenAPIPages(spec.schema);

    const page = pages.find((page) => page.id === props.page);

    if (!page) {
        throw new Error(`Group ${props.page} not found`);
    }

    return getOpenAPIPageDocument({ page, specContent: spec });
}

/**
 * Generate a document for the models page in the OpenAPI specification.
 */
async function generateModelsDocument(
    input: ContentSourceInput<GenerateModelsPageProps, OpenAPIContentSource['dependencies']>,
    ctx: OpenAPIRuntimeContext,
) {
    const { dependencies } = input;
    const specContent = await getOpenAPISpecFromDependencies(dependencies, ctx);
    return getModelsDocument({ specContent });
}

/**
 * Get the OpenAPI specification from the OpenAPI specification dependency.
 */
async function getOpenAPISpecFromDependencies(
    dependencies: ContentSourceDependenciesValueFromRef<OpenAPIContentSource['dependencies']>,
    ctx: OpenAPIRuntimeContext,
) {
    const { api } = ctx;
    const { installation } = ctx.environment;
    const specValue = dependencies.spec.value;

    if (!installation) {
        throw new ExposableError('Installation not found');
    }

    if (specValue?.object !== 'openapi-spec') {
        throw new ExposableError('Invalid spec');
    }

    return getLatestOpenAPISpecContent({
        api,
        openAPISpec: specValue,
        organizationId: installation.target.organization,
    });
}
