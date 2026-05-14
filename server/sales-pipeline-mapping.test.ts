import { describe, expect, it } from "vitest";
import {
  consultStatusToPipelineColumn,
  pipelineColumnToConsultStatus,
} from "../shared/salesPipeline";

describe("salesPipeline mapping", () => {
  it("maps known consult statuses to main columns", () => {
    expect(consultStatusToPipelineColumn("미상담")).toBe("new");
    expect(consultStatusToPipelineColumn("부재")).toBe("new");
    expect(consultStatusToPipelineColumn("통화완료")).toBe("ta");
    expect(consultStatusToPipelineColumn("상담예정")).toBe("ap");
    expect(consultStatusToPipelineColumn("설계중")).toBe("proposal");
    expect(consultStatusToPipelineColumn("계약")).toBe("subscribed");
  });

  it("maps unlisted statuses to other column", () => {
    expect(consultStatusToPipelineColumn("거절")).toBe("other");
    expect(consultStatusToPipelineColumn("보류")).toBe("other");
    expect(consultStatusToPipelineColumn("해지관리")).toBe("other");
    expect(consultStatusToPipelineColumn("재상담필요")).toBe("other");
  });

  it("treats null/empty as new", () => {
    expect(consultStatusToPipelineColumn(null)).toBe("new");
    expect(consultStatusToPipelineColumn(undefined)).toBe("new");
    expect(consultStatusToPipelineColumn("")).toBe("new");
  });

  it("maps pipeline columns back to primary consult status for drops", () => {
    expect(pipelineColumnToConsultStatus("new")).toBe("미상담");
    expect(pipelineColumnToConsultStatus("ta")).toBe("통화완료");
    expect(pipelineColumnToConsultStatus("ap")).toBe("상담예정");
    expect(pipelineColumnToConsultStatus("proposal")).toBe("설계중");
    expect(pipelineColumnToConsultStatus("subscribed")).toBe("계약");
    expect(pipelineColumnToConsultStatus("other")).toBe("보류");
  });
});
