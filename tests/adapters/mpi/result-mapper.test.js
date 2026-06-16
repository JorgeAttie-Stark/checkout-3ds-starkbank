import { describe, expect, it } from "vitest";
import {
  mapDisabled,
  mapFailure,
  mapSuccess,
} from "../../../src/adapters/mpi/result-mapper.js";

describe("adapters/mpi/result-mapper", () => {
  describe("mapSuccess", () => {
    it("preserva todos os campos quando payload completo", () => {
      const result = mapSuccess({
        Cavv: "cavv-x",
        Eci: "05",
        Xid: "xid-1",
        Version: "2.2.0",
        ReferenceId: "ref-1",
      });

      expect(result).toEqual({
        status: "authenticated",
        cavv: "cavv-x",
        eci: "05",
        xid: "xid-1",
        version: "2.2.0",
        referenceId: "ref-1",
      });
    });

    it('defaults strings = "" e xid = null quando payload vazio', () => {
      const result = mapSuccess({});

      expect(result).toEqual({
        status: "authenticated",
        cavv: "",
        eci: "",
        xid: null,
        version: "",
        referenceId: "",
      });
    });

    it("xid explicitamente null permanece null", () => {
      const result = mapSuccess({ Xid: null });
      expect(result.xid).toBeNull();
    });

    it("ignora ReturnCode/ReturnMessage (não fazem parte do sucesso)", () => {
      const result = mapSuccess({
        Cavv: "c",
        Eci: "05",
        Version: "2",
        ReferenceId: "r",
        ReturnCode: "00",
        ReturnMessage: "ok",
      });
      expect(result).not.toHaveProperty("returnCode");
      expect(result).not.toHaveProperty("returnMessage");
    });
  });

  describe("mapFailure", () => {
    it.each(["failed", "unenrolled", "error", "unsupported_brand"])(
      "monta resultado de falha para status %s",
      (status) => {
        const result = mapFailure(status, {
          Eci: "07",
          Xid: "xid-2",
          Version: "2.2.0",
          ReferenceId: "ref-2",
          ReturnCode: "11",
          ReturnMessage: "denied",
        });

        expect(result).toEqual({
          status,
          eci: "07",
          xid: "xid-2",
          version: "2.2.0",
          referenceId: "ref-2",
          returnCode: "11",
          returnMessage: "denied",
        });
      },
    );

    it("xid ausente vira null (paridade as-is)", () => {
      const result = mapFailure("failed", {});
      expect(result.xid).toBeNull();
    });

    it("referenceId ausente vira null", () => {
      const result = mapFailure("failed", {});
      expect(result.referenceId).toBeNull();
    });

    it("eci/version/returnCode/returnMessage ficam undefined quando ausentes", () => {
      const result = mapFailure("failed", {});
      expect(result.eci).toBeUndefined();
      expect(result.version).toBeUndefined();
      expect(result.returnCode).toBeUndefined();
      expect(result.returnMessage).toBeUndefined();
    });
  });

  describe("mapDisabled", () => {
    it("retorna apenas { status: 'disabled' }", () => {
      expect(mapDisabled()).toEqual({ status: "disabled" });
    });
  });
});
