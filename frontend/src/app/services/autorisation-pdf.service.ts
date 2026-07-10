import { Injectable } from "@angular/core";
import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import { ImageHelperService } from "./image-helper.service";

// Compatibilite des polices selon la version de pdfmake (0.1.x / 0.2.x)
(pdfMake as any).vfs =
  (pdfFonts as any).pdfMake?.vfs ??
  (pdfFonts as any).vfs ??
  (pdfMake as any).vfs;

/**
 * Modele de donnees d'une autorisation de peche artisanale.
 * A alimenter depuis l'API FastAPI / PostGIS de SIGDP-GABON.
 */
export interface AutorisationPeche {
  numero: string; // ex: "452"
  anneeValidite: number; // ex: 2026
  proprietaireType: "NATIONAL" | "ETRANGER";

  // Caracteristiques de l'embarcation
  embarcation: {
    nom: string; // ex: "QUI SAIT L'AVENIR"
    immatriculation: string; // ex: "OW.202/12"
    typePirogue: string; // ex: "Bois"
    marqueMoteur: string; // ex: "YAMAHA"
    puissanceCv: number | string; // ex: 40
    debarcadereAttache: string; // ex: "Ozoungué"
    siteDebarquement: string; // ex: "Ozoungué"
  };

  // Identification du proprietaire
  proprietaire: {
    nom: string; // ex: "ANGUEZOMO NGUEMA Hélène"
    nationalite: string; // ex: "Gabonaise"
    typePiece: string; // ex: "Récépissé CNI"
    numeroPiece: string; // ex: "6,3225080609e+014"
    residence: string; // ex: "Owendo"
    telephone: string; // ex: "062-12-02-17"
    cooperative: string; // ex: "COPAN"
  };

  // Techniques et engins
  engins: {
    engin1?: string; // ex: "Senne tournante"
    especes1?: string; // ex: "Sardine"
    engin2?: string;
    especes2?: string;
    codeBarre: string; // contenu encode dans le QR code
  };

  // Validite / paiement
  periodeDebut: string; // ex: "01 Janvier 2026"
  periodeFin: string; // ex: "31 Décembre 2026"
  montantFcfa: number; // ex: 200000
  quittanceTresor: string; // ex: "2419"
  faitA: string; // ex: "Libreville"
  dateFait?: string; // ex: "02 Juin 2026"

  signataire: string; // ex: "Brice Didier Celce KOUMBA MABERT"
  role_signataire: string;
  pour_ordre: boolean;

  /** Logo / armoiries en base64 (data URI), optionnel. */
  logoBase64?: string;
}

const BLEU = "#1f4e79";
const NOIR = "#000000";

@Injectable({ providedIn: "root" })
export class AutorisationPechePdfService {
  constructor(private imageHelper: ImageHelperService) {}
  /** Telecharge le PDF. */
  download(data: AutorisationPeche): void {
    pdfMake
      .createPdf(this.buildDocDefinition(data))
      .download(`autorisation-peche-${data.numero}-${data.anneeValidite}.pdf`);
  }

  /** Ouvre le PDF dans un nouvel onglet (apercu / impression). */
  open(data: AutorisationPeche): void {
    pdfMake.createPdf(this.buildDocDefinition(data)).open();
  }

  /** Retourne le Blob (utile pour upload vers le backend). */
  getBlob(data: AutorisationPeche): Promise<Blob> {
    return new Promise((resolve) => {
      pdfMake.createPdf(this.buildDocDefinition(data)).getBlob(resolve);
    });
  }

  // ----------------------------------------------------------------------
  // Helpers de mise en page
  // ----------------------------------------------------------------------

  /** Petite case a cocher (cochee ou non). Type `any` car `width` n'existe
   *  pas sur `Content`/`ContentTable` mais est valide sur un item de `columns`. */
  private checkbox(checked: boolean): any {
    return {
      table: {
        widths: [9],
        body: [
          [
            {
              text: checked ? "X" : " ",
              fontSize: 8,
              alignment: "center",
              margin: [0, 0, 0, 0],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 0.8,
        vLineWidth: () => 0.8,
        paddingLeft: () => 1,
        paddingRight: () => 1,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
      width: 12,
    };
  }

  /** Cadre a bordure unique enveloppant un contenu. */
  private box(content: Content): Content {
    return {
      table: {
        widths: ["*"],
        body: [
          [
            {
              stack: Array.isArray(content) ? content : [content],
              margin: [4, 4, 4, 4],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 0.8,
        vLineWidth: () => 0.8,
        hLineColor: () => NOIR,
        vLineColor: () => NOIR,
      },
    };
  }

  /** Titre de section (gras, majuscules). */
  private sectionTitle(text: string): Content {
    return { text, bold: true, fontSize: 11, margin: [0, 8, 0, 2] };
  }

  /** Bloc de visa dans la marge gauche. */
  private visa(lines: string[]): Content {
    return {
      stack: lines.map((l, i) => ({
        text: l,
        bold: i === 0,
        italics: i > 0,
        fontSize: i === 0 ? 10 : 8,
        margin: [0, i === 0 ? 0 : 1, 0, 0],
      })),
      margin: [0, 6, 0, 0],
    };
  }

  private formatXAF(amount: number): string {
    return (
      Math.round(amount)
        .toLocaleString("fr-FR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
        .replace(/\u202f/g, " ") + " FCFA"
    );
  }

  private signatureLabel(data: any): Content {
    if (data.pour_ordre) {
      return {
        columns: [
          {
            text: "",
          },
          {
            text: "",
          },
          {
            stack: [
              {
                text: "P. Le Ministre",
                italics: true,
                // bold: true,
                fontSize: 11,
                alignment: "center",
                margin: [0, 20, 50, 0],
              },
              {
                text: `P.O ${data.role_signataire}`,
                italics: true,
                // bold: true,
                fontSize: 11,
                alignment: "center",
                margin: [0, 10, 20, 0],
              },
              {
                text: data.signataire,
                bold: true,
                italics: true,
                fontSize: 12,
                alignment: "center",
                margin: [0, 50, 20, 0],
              },
            ],
          },
        ],
        margin: [0, 14, 0, 0],
      };
    } else {
      return {
        columns: [
          {
            text: "",
          },
          {
            text: "",
          },
          {
            stack: [
              {
                text: "Le Ministre",
                italics: true,
                fontSize: 11,
                alignment: "center",
                margin: [0, 20, 50, 0],
              },
              { text: "", margin: [0, 30, 0, 0] },
              {
                text: data.signataire,
                bold: true,
                italics: true,
                fontSize: 12,
                alignment: "center",
                margin: [0, 30, 0, 0],
              },
            ],
          },
        ],
        margin: [0, 14, 0, 0],
      };
    }
  }

  private formatedImmatrication(data: any) {
    const parts = data.split("/");
    // const padded = parts[0].padStart(3, "0") + "/" + parts[1];
    const autorisation_number = parts[0].padStart(3, "0");
    return autorisation_number;
  }

  // ----------------------------------------------------------------------
  // Document
  // ----------------------------------------------------------------------

  private buildDocDefinition(d: AutorisationPeche): TDocumentDefinitions {
    const ministryBlock: Content = {
      stack: [
        {
          text: "MINISTERE DE LA MER, DE LA PECHE",
          bold: true,
          fontSize: 6,
          color: BLEU,
        },
        {
          text: "ET DE L'ECONOMIE BLEUE",
          bold: true,
          fontSize: 6,
          color: BLEU,
        },
        { text: "------------------", fontSize: 7, margin: [0, 1, 0, 1] },
        {
          text: "SECRETARIAT GENERAL",
          fontSize: 6,
          color: BLEU,
          margin: [0, 1, 0, 0],
        },
        { text: "------------------", fontSize: 7, margin: [0, 1, 0, 1] },
        {
          text: "DIRECTION GENERALE DES PECHES",
          bold: true,
          fontSize: 6,
          color: BLEU,
        },
        { text: "ET DE L'AQUACULTURE", bold: true, fontSize: 6, color: BLEU },
        { text: "------------------", fontSize: 7, margin: [0, 1, 0, 1] },
        { text: "DIRECTION DES PECHES", fontSize: 6, color: BLEU },
        {
          text: "B.P : 9498 – Tel : 01 76 80 07 – Fax : 01 76 46 02",
          fontSize: 6,
          margin: [0, 3, 0, 0],
        },
      ],
    };

    const titleBlock: Content = {
      stack: [
        {
          text: "AUTORISATION",
          fontSize: 18,
          bold: true,
          color: BLEU,
          alignment: "center",
        },
        {
          text: "DE PECHE ARTISANALE",
          fontSize: 18,
          bold: true,
          color: BLEU,
          alignment: "center",
        },
        {
          text: `N° ${this.formatedImmatrication(d.numero)}`,
          fontSize: 16,
          bold: true,
          color: BLEU,
          alignment: "center",
          margin: [0, 2, 0, 4],
        },
        {
          columns: [
            { width: "*", text: "" },
            {
              width: "auto",
              stack: [
                {
                  text: `ANNEE DE VALIDITE  ${d.anneeValidite}`,
                  bold: true,
                  fontSize: 10,
                },
                {
                  columns: [
                    {
                      width: "auto",
                      text: "PROPRIETAIRE : ",
                      bold: true,
                      fontSize: 10,
                      margin: [0, 1, 4, 0],
                    },
                    this.checkbox(d.proprietaireType === "NATIONAL"),
                    {
                      width: "auto",
                      text: " NATIONAL",
                      bold: true,
                      fontSize: 10,
                      margin: [2, 1, 0, 0],
                    },
                  ],
                  margin: [0, 2, 0, 0],
                },
                {
                  columns: [
                    this.checkbox(d.proprietaireType === "ETRANGER"),
                    {
                      width: "auto",
                      text: " ETRANGER",
                      bold: true,
                      fontSize: 10,
                      margin: [2, 1, 0, 0],
                    },
                  ],
                  margin: [0, 2, 0, 0],
                },
              ],
            },
          ],
        },
      ],
    };

    const header: Content = {
      columns: [
        { width: "30%", ...ministryBlock },
        { width: "40%", ...titleBlock, margin: [0, 50, 0, 0] },
        {
          width: "*",
          stack: [
            d.logoBase64
              ? {
                  image: d.logoBase64,
                  fit: [250, 250],
                  alignment: "right",
                  margin: [0, -50, 0, 0],
                }
              : {
                  text: "RÉPUBLIQUE\nGABONAISE",
                  fontSize: 7,
                  alignment: "right",
                  color: BLEU,
                  margin: [0, 0, 0, 4],
                },
            // titleBlock,
          ],
        },
      ],
      margin: [0, 0, 0, 6],
    };

    // -- Caracteristiques de l'embarcation
    const embarcationBox = this.box([
      {
        text: [{ text: "Nom : ", bold: false }, { text: d.embarcation.nom }],
        fontSize: 10,
      },
      {
        text: `N° d'immatriculation : ${d.embarcation.immatriculation}`,
        fontSize: 10,
        margin: [0, 1, 0, 0],
      },
      {
        text: `Type de pirogue : ${d.embarcation.typePirogue}`,
        fontSize: 10,
        margin: [0, 1, 0, 0],
      },
      {
        text: `Marque ${d.embarcation.marqueMoteur} / Puissance motrice : ${d.embarcation.puissanceCv} CV`,
        fontSize: 10,
        margin: [0, 1, 0, 0],
      },
      {
        text: `Débarcadère d'attache : ${d.embarcation.debarcadereAttache}`,
        fontSize: 10,
        margin: [0, 1, 0, 0],
      },
      {
        text: `Site de débarquement : ${d.embarcation.siteDebarquement}`,
        bold: true,
        fontSize: 10,
        margin: [10, 1, 0, 0],
      },
    ]);

    const embarcationRow: Content = {
      columns: [
        { width: 80, ...(this.visa(["VISA", "DP"]) as any) },
        {
          width: "*",
          stack: [
            this.sectionTitle("CARACTERISTIQUES DE L'EMBARCATION"),
            embarcationBox,
          ],
        },
      ],
    };

    // -- Identification du proprietaire
    const proprietaireBox = this.box([
      {
        text: [
          { text: "Nom du propriétaire : " },
          { text: d.proprietaire.nom },
          { text: "   Nationalité : " },
          { text: d.proprietaire.nationalite },
        ],
        fontSize: 10,
      },
      {
        text: `Type et numéro de pièce d'identification : ${d.proprietaire.typePiece} ${d.proprietaire.numeroPiece}`,
        fontSize: 10,
        margin: [0, 3, 0, 0],
      },
      {
        text: `Résidence : ${d.proprietaire.residence}   Tel. ${d.proprietaire.telephone}   Coopérative : ${d.proprietaire.cooperative}`,
        fontSize: 10,
        margin: [0, 3, 0, 0],
      },
    ]);

    const proprietaireRow: Content = {
      columns: [
        { width: 80, text: "" },
        {
          width: "*",
          stack: [
            this.sectionTitle("IDENTIFICATION DU PROPRIETAIRE"),
            proprietaireBox,
          ],
        },
      ],
    };

    // -- Techniques et engins de peche (QR + types)
    const enginsTable: Content = {
      table: {
        widths: ["45%", "55%"],
        body: [
          [
            {
              text: "CODE BARRE",
              bold: true,
              fontSize: 11,
              alignment: "center",
              margin: [0, 4, 0, 4],
            },
            {
              text: "TYPES DE PECHE AUTORISES",
              bold: true,
              fontSize: 11,
              alignment: "center",
              margin: [0, 4, 0, 4],
            },
          ],
          [
            {
              qr: d.engins.codeBarre,
              fit: 120,
              alignment: "center",
              margin: [0, 8, 0, 8],
            },
            {
              stack: [
                {
                  text: `Engin de pêche 1 : ${d.engins.engin1 ?? ""}`,
                  fontSize: 10,
                },
                {
                  text: `Espèces cibles 1 : ${d.engins.especes1 ?? ""}`,
                  fontSize: 10,
                  margin: [0, 2, 0, 10],
                },
                {
                  text: `Engin de pêche 2 : ${d.engins.engin2 ?? ""}`,
                  fontSize: 10,
                },
                {
                  text: `Espèces cibles 2 : ${d.engins.especes2 ?? ""}`,
                  fontSize: 10,
                  margin: [0, 2, 0, 0],
                },
              ],
              margin: [6, 8, 0, 8],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 0.8,
        vLineWidth: () => 0.8,
        hLineColor: () => NOIR,
        vLineColor: () => NOIR,
      },
    };

    const enginsRow: Content = {
      columns: [
        {
          width: 80,
          stack: [
            this.visa(["VISA", "Responsable", "service", "(SPA/CB/DP)"]) as any,
          ],
        },
        {
          width: "*",
          stack: [
            this.sectionTitle("TECHNIQUES ET ENGINS DE PECHE"),
            enginsTable,
          ],
        },
      ],
    };

    // -- Periode / montant / quittance
    const validiteBox: Content = {
      table: {
        widths: ["*"],
        body: [
          [
            {
              text: [
                {
                  text: "PERIODE DE VALIDITE DE L'AUTORISATION :  ",
                  bold: true,
                },
                { text: `DU ${d.periodeDebut}   AU ${d.periodeFin}` },
              ],
              fontSize: 10,
              margin: [4, 3, 4, 3],
            },
          ],
          [
            {
              text: [
                { text: "MONTANT DE L'AUTORISATION : ", bold: true },
                {
                  text: `${this.formatXAF(d.montantFcfa)}`,
                },
              ],
              fontSize: 10,
              margin: [4, 3, 4, 3],
            },
          ],
          [
            {
              columns: [
                {
                  width: "50%",
                  text: `Quittance Trésor : ${d.quittanceTresor}`,
                  fontSize: 10,
                },
                {
                  width: "*",
                  text: `Fait à ${d.faitA}, le ${d.dateFait ?? ""}`,
                  italics: true,
                  fontSize: 10,
                },
              ],
              margin: [4, 3, 4, 3],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 0.8,
        vLineWidth: () => 0.8,
        hLineColor: () => NOIR,
        vLineColor: () => NOIR,
      },
      margin: [0, 10, 0, 0],
    };

    // -- Signature
    const signature: Content = this.signatureLabel(d);

    return {
      pageSize: "A4",
      pageMargins: [36, 32, 36, 36],
      defaultStyle: { font: "Roboto", fontSize: 10, color: NOIR },
      content: [
        header,
        embarcationRow,
        proprietaireRow,
        enginsRow,
        validiteBox,
        signature,
      ],
    };
  }
}
