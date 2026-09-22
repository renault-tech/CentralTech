import { describe, expect, it } from "vitest";

import {
  dataNoFuso,
  diasDeCalendarioEntre,
  fimDoDiaNoFuso,
  inicioDoDiaNoFuso,
} from "./fuso";

describe("dataNoFuso", () => {
  it("usa o dia de Brasília, não o do UTC", () => {
    // 26/07 às 23h de Brasília = 27/07 02h UTC. O dia certo é 26.
    expect(dataNoFuso(new Date("2026-07-27T02:00:00Z"))).toBe("2026-07-26");
  });

  it("vira o dia no horário certo (00h de Brasília = 03h UTC)", () => {
    expect(dataNoFuso(new Date("2026-07-27T02:59:00Z"))).toBe("2026-07-26");
    expect(dataNoFuso(new Date("2026-07-27T03:00:00Z"))).toBe("2026-07-27");
  });
});

describe("diasDeCalendarioEntre", () => {
  it("conta 0 dentro do mesmo dia de Brasília", () => {
    // 08h e 20h do dia 26 em Brasília (11h e 23h UTC).
    const manha = new Date("2026-07-26T11:00:00Z");
    const noite = new Date("2026-07-26T23:00:00Z");
    expect(diasDeCalendarioEntre(manha, noite)).toBe(0);
  });

  it("conta 1 na virada, mesmo com poucas horas de diferença", () => {
    // 23h do dia 26 e 01h do dia 27, ambos em Brasília.
    const antes = new Date("2026-07-27T02:00:00Z");
    const depois = new Date("2026-07-27T04:00:00Z");
    expect(diasDeCalendarioEntre(antes, depois)).toBe(1);
  });

  it("é o caso que quebrava em UTC: 21h-00h não pode adiantar o dia", () => {
    // 21h do dia 26 em Brasília já é 27 em UTC. Contando em UTC daria 1;
    // no fuso da plataforma ainda é o mesmo dia, então 0.
    const inicioDoTrabalho = new Date("2026-07-26T12:00:00Z"); // 09h BRT dia 26
    const fimDaNoite = new Date("2026-07-27T00:30:00Z"); // 21h30 BRT dia 26
    expect(diasDeCalendarioEntre(inicioDoTrabalho, fimDaNoite)).toBe(0);
  });

  it("devolve negativo quando o fim é anterior", () => {
    expect(
      diasDeCalendarioEntre(new Date("2026-07-28T15:00:00Z"), new Date("2026-07-26T15:00:00Z"))
    ).toBe(-2);
  });
});

describe("bordas do dia para filtro de timestamptz", () => {
  it("marca o início do dia com o offset de Brasília", () => {
    expect(inicioDoDiaNoFuso("2026-07-26")).toBe("2026-07-26T00:00:00.000-03:00");
  });

  it("marca o fim do dia incluindo os últimos milissegundos", () => {
    expect(fimDoDiaNoFuso("2026-07-26")).toBe("2026-07-26T23:59:59.999-03:00");
  });

  it("o fim do dia cobre um log das 21h (o que se perdia antes)", () => {
    // 21h30 de Brasília do dia 26 = 27/07 00h30 UTC.
    const logDaNoite = new Date("2026-07-27T00:30:00Z");
    expect(logDaNoite.getTime()).toBeLessThanOrEqual(
      Date.parse(fimDoDiaNoFuso("2026-07-26"))
    );
    // E não vaza para o dia seguinte.
    expect(logDaNoite.getTime()).toBeLessThan(Date.parse(inicioDoDiaNoFuso("2026-07-27")));
  });

  it("o início do dia não puxa o fim do dia anterior", () => {
    // 23h de Brasília do dia 25 = 26/07 02h UTC — não pode entrar no dia 26.
    const logDaVespera = new Date("2026-07-26T02:00:00Z");
    expect(logDaVespera.getTime()).toBeLessThan(Date.parse(inicioDoDiaNoFuso("2026-07-26")));
  });
});
