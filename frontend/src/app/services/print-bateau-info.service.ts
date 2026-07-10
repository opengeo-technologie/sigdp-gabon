import { Injectable } from "@angular/core";
import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import { ImageHelperService } from "./image-helper.service";
import { Bateau } from "../models/bateau.model";
import { fontStyle } from "html2canvas/dist/types/css/property-descriptors/font-style";
import { color } from "html2canvas/dist/types/css/types/color";

// Compatibilite des polices selon la version de pdfmake (0.1.x / 0.2.x)
(pdfMake as any).vfs =
  (pdfFonts as any).pdfMake?.vfs ??
  (pdfFonts as any).vfs ??
  (pdfMake as any).vfs;

/**
 * Modele de donnees d'une autorisation de peche artisanale.
 * A alimenter depuis l'API FastAPI / PostGIS de SIGDP-GABON.
 */
export interface BateauInfo {
  bateau?: Bateau;
  licences?: any[];
  logoBase64?: string;
}

const BLEU = "#1f4e79";
const NOIR = "#000000";

@Injectable({
  providedIn: "root",
})
export class PrintBateauInfoService {
  constructor(private imageHelper: ImageHelperService) {}
  /** Telecharge le PDF. */
  download(data: BateauInfo): void {
    pdfMake
      .createPdf(this.buildDocDefinition(data))
      .download(
        `bateau-${data.bateau?.numero_immatriculation}-${data.bateau?.nom_bateau}.pdf`,
      );
  }

  /** Ouvre le PDF dans un nouvel onglet (apercu / impression). */
  open(data: BateauInfo): void {
    pdfMake.createPdf(this.buildDocDefinition(data)).open();
  }

  /** Retourne le Blob (utile pour upload vers le backend). */
  getBlob(data: BateauInfo): Promise<Blob> {
    return new Promise((resolve) => {
      pdfMake.createPdf(this.buildDocDefinition(data)).getBlob(resolve);
    });
  }

  arrayToString(array: any[] | undefined): string {
    if (!array || array.length === 0) {
      return "N/A";
    }
    return array.map((s) => s.nom).join(", ");
  }

  private sectionTitle(text: string): Content {
    return { text, bold: true, fontSize: 11, margin: [0, 8, 0, 2] };
  }

  private tableColumn1(text: string): Content {
    return {
      text: text,
      bold: true,
      fontSize: 9,
      margin: [0, 5, 0, 2],
    };
  }

  private tableColumn2(text: any | undefined) {
    if (text == undefined) {
      return {
        text: "Non renseigné",
        italics: true,
        fontSize: 9,
        color: BLEU,
        margin: [0, 5, 0, 2],
      };
    } else {
      return {
        text: text,
        fontSize: 9,
        margin: [0, 5, 0, 2],
      };
    }
  }

  private buildDocDefinition(d: BateauInfo): TDocumentDefinitions {
    const ministryBlock: Content = {
      stack: [
        {
          text: "MINISTERE DE LA MER, DE LA PECHE",
          bold: true,
          fontSize: 8,
          color: NOIR,
        },
        {
          text: "ET DE L'ECONOMIE BLEUE",
          bold: true,
          fontSize: 8,
          color: NOIR,
        },
        { text: "------------------", fontSize: 7, margin: [0, 1, 0, 1] },
        {
          text: "SECRETARIAT GENERAL",
          fontSize: 8,
          color: NOIR,
          margin: [0, 1, 0, 0],
        },
        { text: "------------------", fontSize: 7, margin: [0, 1, 0, 1] },
        {
          text: "DIRECTION GENERALE DES PECHES",
          bold: true,
          fontSize: 8,
          color: NOIR,
        },
        { text: "ET DE L'AQUACULTURE", bold: true, fontSize: 8, color: NOIR },
        { text: "------------------", fontSize: 7, margin: [0, 1, 0, 1] },
        { text: "DIRECTION DES PECHES", fontSize: 8, color: NOIR },
        {
          text: "B.P : 9498 – Tel : 01 76 80 07 – Fax : 01 76 46 02",
          fontSize: 8,
          margin: [0, 3, 0, 0],
        },
      ],
    };

    const titleBlock: Content = {
      stack: [
        {
          text: "Fiche descriptive d'embarcation".toUpperCase(),
          fontSize: 18,
          bold: true,
          color: BLEU,
          alignment: "center",
          decoration: "underline",
          margin: [0, 20, 0, 0],
        },
      ],
    };

    const embarcationRow: Content = {
      stack: [
        this.sectionTitle("Caracteristiques embarcation"),
        {
          table: {
            // Defines the number of columns and their widths
            widths: ["*", "*"],
            body: [
              [
                this.tableColumn1("Immatriculation"),
                this.tableColumn2(d.bateau?.numero_immatriculation),
              ],
              [
                this.tableColumn1("Nom embarcation"),
                this.tableColumn2(d.bateau?.nom_bateau),
              ],
              [
                this.tableColumn1("Type"),
                this.tableColumn2(d.bateau?.type_bateau),
              ],
              [
                this.tableColumn1("Année de construction"),
                this.tableColumn2(d.bateau?.annee_construction),
              ],
              [
                this.tableColumn1("Propulsion"),
                this.tableColumn2(d.bateau?.propulsion),
              ],
              [
                this.tableColumn1("Matériau"),
                this.tableColumn2(d.bateau?.materiau_coque),
              ],
              [
                this.tableColumn1("Longeur"),
                this.tableColumn2(d.bateau?.longueur_hors_tout),
              ],
              [
                this.tableColumn1("Largeur"),
                this.tableColumn2(d.bateau?.largeur),
              ],
              [
                this.tableColumn1("Jauge"),
                this.tableColumn2(d.bateau?.jauge_brute),
              ],
              [
                this.tableColumn1("Marque moteur"),
                this.tableColumn2(d.bateau?.moteur_marque),
              ],
              [
                this.tableColumn1("Puissance moteur"),
                this.tableColumn2(d.bateau?.moteur_puissance_cv),
              ],
              // [
              //   "Puissance moteur",
              //   d.bateau?.moteur_puissance_cv + "cv" || "Non renseigné",
              // ],
            ] as any,
          },
        },
      ],
    };

    const enginsRow: Content = {
      stack: [
        this.sectionTitle(
          "Engins de pêche, Site d'attache, Site de débarquement",
        ),
        {
          table: {
            // Defines the number of columns and their widths
            widths: ["*", "*"],
            body: [
              [
                this.tableColumn1("Engin de pêche principal"),
                this.tableColumn2(d.bateau?.engin_peche1.libelle),
              ],
              [
                this.tableColumn1("Engin de pêche secondaire"),
                this.tableColumn2(d.bateau?.engin_peche2),
              ],
              [
                this.tableColumn1("Site d'attache"),
                this.tableColumn2(d.bateau?.site_port_attache_info?.nom),
              ],
              [
                this.tableColumn1("Sites de débarquement"),
                this.tableColumn2(
                  this.arrayToString(d.bateau?.site_obligatoire_info),
                ),
              ],
            ] as any,
          },
        },
      ],
    };

    const proprietaireRow: Content = {
      stack: [
        this.sectionTitle("Propriétaire embarcation"),
        {
          table: {
            // Defines the number of columns and their widths
            widths: ["*", "*"],
            body: [
              [
                this.tableColumn1("Numéro carte"),
                this.tableColumn2(d.bateau?.proprietaire_info?.numero_carte),
              ],
              [
                this.tableColumn1("Nom et prénom"),
                this.tableColumn2(
                  d.bateau?.proprietaire_info?.nom +
                    " " +
                    d.bateau?.proprietaire_info?.prenom,
                ),
              ],
              [
                this.tableColumn1("Nationalité"),
                this.tableColumn2(d.bateau?.proprietaire_info?.nationalite),
              ],
              [
                this.tableColumn1("Type pièce d'identité / Numéro piece"),
                this.tableColumn2(
                  d.bateau?.proprietaire_info?.type_carte +
                    "/" +
                    d.bateau?.proprietaire_info?.numero_piece,
                ),
              ],
              [
                this.tableColumn1("Résidence"),
                this.tableColumn2(d.bateau?.proprietaire_info?.residence),
              ],
            ] as any,
          },
        },
      ],
    };

    const cooperativeRow: Content = {
      stack: [
        this.sectionTitle("Coopérative ou armement"),
        {
          table: {
            // Defines the number of columns and their widths
            widths: ["*", "*"],
            body: [
              [
                this.tableColumn1("Nom coopérative"),
                this.tableColumn2(
                  d.bateau?.cooperative_armement_info?.denomination,
                ),
              ],
            ] as any,
          },
        },
      ],
    };

    // const LicenceAutorisationRow: Content = {
    //   stack: [
    //     this.sectionTitle("Licence ou Autorisation de pêche"),
    //     {
    //       table: {
    //         // Defines the number of columns and their widths
    //         widths: ["*", "*"],
    //         body: [
    //           [
    //             this.tableColumn1("Nom coopérative"),
    //             this.tableColumn2(
    //               d.bateau?.cooperative_armement_info?.denomination,
    //             ),
    //           ],
    //         ] as any,
    //       },
    //     },
    //   ],
    // };

    const header: Content = {
      columns: [
        { width: "40%", ...ministryBlock },
        { width: "30%", text: "" },
        {
          width: "*",
          stack: [
            d.logoBase64
              ? {
                  image: d.logoBase64,
                  fit: [250, 250],
                  alignment: "right",
                  margin: [0, -35, 0, 0],
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

    return {
      pageSize: "A4",
      pageMargins: [36, 32, 36, 36],
      defaultStyle: { font: "Roboto", fontSize: 10, color: NOIR },
      background: [
        {
          svg: `<svg width="155" height="155" xmlns="http://www.w3.org/2000/svg">
                    <rect x="0" y="31" width="200" height="25" fill="#009E60" transform="rotate(-45 40 80)"/>
                    <rect x="0" y="76" width="250" height="25" fill="#FCD116" transform="rotate(-45 40 150)"/>
                    <rect x="0" y="115" width="3000" height="25" fill="#4664B2" transform="rotate(-45 40 200)"/>
                  </svg>`,
          width: 155,
          height: 155,
        },
      ],
      content: [
        header,
        titleBlock,
        embarcationRow,
        enginsRow,
        proprietaireRow,
        cooperativeRow,
      ],
    };
  }
}
