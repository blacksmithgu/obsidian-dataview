/** A imperative query which operates via a series of sequential operations. */
import { Source, Field, NamedField } from './query';

/** The source of rows that will go through the pipeline. */
export type SourceType = 'pages' | 'tasks';
/** Steps in the pipeline to execute over the data. */
export type PipelineStep = WhereStep | SetStep | FlattenStep | GroupStep | ListStep | TableStep;

export class WhereStep {
    type: 'where';
    /** The clause to filter on. */
    clause: Field;
}

export class SetStep {
    type: 'set';
    /** The new variable being defined. */
    variable: string;
    /** The value this variable will be set too. */
    value: Field;
}

export class FlattenStep {
    type: 'flatten';
    /** The target field to flatten. */
    target: Field;
    /** The variable which the flattened values will be inserted into. */
    output: string;
}

export class GroupStep {
    type: 'group';
    /** The field to group by. */
    target: Field;
}

export class ListStep {
    type: 'list';
    /** If defined, the format which list entries should take. */
    format?: string;
}

export class TableStep {
    type: 'table';
    fields: NamedField[];
}

/** A query which consists of multiple distinct stages. */
export class PipelineQuery {
    /** The source which pipeline elements will be obntained from. */
    source: {
        /** The type of data being loaded. */
        type: SourceType;
        /** The  */
        query: Source;
    };

    /** The steps to execute for this pipeline. */
    steps: PipelineStep[];
}