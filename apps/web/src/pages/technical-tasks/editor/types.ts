import type { TzXmlModel, ValidationIssue } from '@tz-xml';

export interface BlockProps {
  taskId: string;
  model: TzXmlModel;
  onChange: (model: TzXmlModel) => void;
  issues: ValidationIssue[];
}
