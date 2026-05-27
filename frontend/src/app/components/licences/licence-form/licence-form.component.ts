import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import * as pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import { textAlign } from "html2canvas/dist/types/css/property-descriptors/text-align";
import { ImageHelperService } from "../../../services/image-helper.service";

const configurePdfMake = () => {
  const pdfMakeInstance: any = pdfMake;

  // Essaie 3 stratégies différentes
  if (pdfFonts && (pdfFonts as any).pdfMake?.vfs) {
    pdfMakeInstance.vfs = (pdfFonts as any).pdfMake.vfs;
  } else if ((pdfFonts as any).vfs) {
    pdfMakeInstance.vfs = (pdfFonts as any).vfs;
  } else if (pdfFonts) {
    pdfMakeInstance.vfs = pdfFonts;
  }

  return pdfMakeInstance;
};

interface LicenseData {
  licenseNumber: string;
  year: string;
  armement: string;
  navName: string;
  nationality: string;
  immatriculation: string;
  tjb: string;
  portAttache: string;
  puissance: string;
  proprietaire: string;
  armateur: string;
  materiel: string;
  dateDebut: string;
  dateFin: string;
  ordreRecette: string;
  dateEmission: string;
  ministre: string;
  typesPeche: {
    poissonsFond: boolean;
    crustaces: boolean;
    petitsPelagiques: boolean;
    thons: boolean;
    autres: boolean;
  };
}

@Component({
  selector: "app-licence-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./licence-form.component.html",
  styleUrl: "./licence-form.component.scss",
})
export class LicenceFormComponent {
  licenseForm!: FormGroup;
  isGenerating = false;

  constructor(
    private fb: FormBuilder,
    private imageHelper: ImageHelperService,
  ) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  private initializeForm(): void {
    const currentYear = new Date().getFullYear();

    this.licenseForm = this.fb.group({
      licenseNumber: ["014", Validators.required],
      year: [currentYear.toString(), Validators.required],
      armement: ["national", Validators.required],

      // Caractéristiques du navire
      navName: ["MONTERAIOLA", Validators.required],
      nationality: ["Espagnole", Validators.required],
      immatriculation: ["3CO-2-1-20", Validators.required],
      tjb: ["1976", Validators.required],
      portAttache: ["ACORUNA", Validators.required],
      puissance: ["3392", Validators.required],

      // Armement
      proprietaire: ["CANTABRICA DE TUNIDOS, S.A.U", Validators.required],
      armateur: ["OPAGAC", Validators.required],

      // Types de pêche
      poissonsFond: [false],
      crustaces: [false],
      petitsPelagiques: [false],
      thons: [true],
      autres: [false],

      materiel: ["Thonier senneur"],

      // Dates
      dateDebut: [
        this.formatDateForInput(new Date(currentYear, 0, 1)),
        Validators.required,
      ],
      dateFin: [
        this.formatDateForInput(new Date(currentYear, 5, 30)),
        Validators.required,
      ],

      // Administration
      ordreRecette: ["Swift N° 00491893632BCKHNQC", Validators.required],
      dateEmission: [
        this.formatDateForInput(new Date(currentYear - 1, 11, 5)),
        Validators.required,
      ],
      ministre: ["Aimé Martial MASSAMBA", Validators.required],
    });
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private formatDateFrench(dateStr: string): string {
    const date = new Date(dateStr);
    const months = [
      "Janvier",
      "Février",
      "Mars",
      "Avril",
      "Mai",
      "Juin",
      "Juillet",
      "Août",
      "Septembre",
      "Octobre",
      "Novembre",
      "Décembre",
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  private getSelectedTypesPeche(): string[] {
    const types: string[] = [];
    const formValue = this.licenseForm.value;

    if (formValue.poissonsFond) types.push("Poissons de fond");
    if (formValue.crustaces) types.push("Crustacés");
    if (formValue.petitsPelagiques) types.push("Petits pélagiques");
    if (formValue.thons) types.push("Thons");
    if (formValue.autres) types.push("Autres");

    return types;
  }

  private createCheckbox(isChecked: boolean): any {
    return {
      canvas: [
        { type: "rect", x: 0, y: 0, w: 12, h: 12, lineWidth: 1 },
        ...(isChecked
          ? [
              { type: "line", x1: 2, y1: 2, x2: 10, y2: 10, lineWidth: 2 },
              { type: "line", x1: 10, y1: 2, x2: 2, y2: 10, lineWidth: 2 },
            ]
          : []),
      ],
      margin: [0, 2, 5, 2],
    };
  }

  async generatePDF(): Promise<void> {
    const imageUrl = "../../../../assets/logo_dp.jpeg";

    const base64ImageString =
      await this.imageHelper.getBase64ImageFromURL(imageUrl);

    if (this.licenseForm.invalid) {
      alert("Veuillez remplir tous les champs obligatoires");
      return;
    }

    this.isGenerating = true;
    const formValue = this.licenseForm.value;
    const typesPeche = this.getSelectedTypesPeche();

    try {
      const docDefinition: any = {
        pageSize: "A4",
        pageMargins: [40, 100, 40, 60],

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

        header: (currentPage: number, pageCount: number) => {
          return {
            columns: [
              {
                width: "30%",
                stack: [
                  {
                    text: "MINISTÈRE DE LA MER,DE LA PÊCHE",
                    fontSize: 8,
                    bold: true,
                    alignment: "center",
                  },
                  {
                    text: "ET DE L'ÉCONOMIE BLEUE",
                    fontSize: 8,
                    bold: true,
                    alignment: "center",
                  },
                  {
                    text: "----------------------------------------------------------",
                    fontSize: 4,
                    alignment: "center",
                  },
                  {
                    text: "SECRÉTARIAT GÉNÉRAL",
                    fontSize: 8,
                    alignment: "center",
                  },
                  {
                    text: "----------------------------------------------------------",
                    fontSize: 4,
                    alignment: "center",
                  },
                  {
                    text: "DIRECTION GÉNÉRALE DES PÊCHES",
                    fontSize: 8,
                    bold: true,
                    alignment: "center",
                  },
                  {
                    text: "ET DE L'AQUACULTURE",
                    fontSize: 8,
                    bold: true,
                    alignment: "center",
                  },
                  {
                    text: "----------------------------------------------------------",
                    fontSize: 4,
                    alignment: "center",
                  },
                  {
                    text: "DIRECTION DES PÊCHES",
                    fontSize: 8,
                    alignment: "center",
                  },
                  {
                    text: "----------------------------------------------------------",
                    fontSize: 4,
                    alignment: "center",
                  },
                ],
                margin: [40, 20, 0, 0],
              },
              {
                width: "40%",
                margin: [0, 50, 0, 0],
                stack: [
                  {
                    text: `ANNÉE DE VALIDITÉ ${formValue.year}`,
                    fontSize: 12,
                    bold: true,
                    alignment: "center",
                    margin: [0, 10, 0, 5],
                  },
                  {
                    text: `LICENCE DE PÊCHE N°${formValue.licenseNumber}`,
                    fontSize: 16,
                    bold: true,
                    alignment: "center",
                    margin: [0, 0, 0, 10],
                  },
                ],
              },
              {
                width: "30%",
                stack: [
                  {
                    text: "RÉPUBLIQUE GABONAISE",
                    fontSize: 10,
                    bold: true,
                    alignment: "center",
                  },
                  {
                    text: "----------------------------------------------------------",
                    fontSize: 4,
                    alignment: "center",
                  },
                  {
                    text: "Union-Travail-Justice",
                    fontSize: 9,
                    alignment: "center",
                    margin: [0, 2, 0, 0],
                  },
                  {
                    text: "----------------------------------------------------------",
                    fontSize: 4,
                    alignment: "center",
                  },
                ],
                margin: [0, 20, 40, 0],
              },
            ],
          };
        },

        content: [
          // Titre principal

          {
            text: `ARMEMENT (1) : NATIONAL`,
            fontSize: 11,
            alignment: "center",
            margin: [0, 20, 0, 5],
          },
          {
            canvas: [
              {
                type: "rect",
                x: 400,
                y: -25,
                w: 15,
                h: 15,
                lineWidth: 1,
                lineColor: "#000000",
              },
              {
                type: "text",
                x: 404, // Roughly centered (adjust based on character)
                y: -15, // Centered vertically
                text: "✓", // Or "T", "X", etc.
                fontSize: 10,
                color: "#000000",
              },
            ],
          },
          {
            text: `ETRANGER`,
            fontSize: 11,
            alignment: "center",
            margin: [90, 10, 0, 5],
          },
          {
            canvas: [
              {
                type: "rect",
                x: 400,
                y: -20,
                w: 15,
                h: 15,
                lineWidth: 1,
                lineColor: "#000000",
                color: "#252525", // Fill color for "checked"
                fillOpacity: 1,
              },
            ],
          },

          // Section Caractéristiques du navire
          {
            text: "CARACTÉRISTIQUES DU NAVIRE",
            fontSize: 11,
            bold: true,
            alignment: "center",
            margin: [0, 15, 0, 10],
          },
          {
            table: {
              widths: ["50%", "50%"],
              body: [
                [
                  {
                    text: `Nom : ${formValue.navName}`,
                    fontSize: 10,
                    border: [true, true, true, false],
                  },
                  {
                    text: `Nationalité : ${formValue.nationality}`,
                    fontSize: 10,
                    border: [true, true, true, false],
                  },
                ],
                [
                  {
                    text: `N° Immatriculation : ${formValue.immatriculation}`,
                    fontSize: 10,
                    border: [true, false, true, false],
                  },
                  {
                    text: `TJB : ${formValue.tjb}`,
                    fontSize: 10,
                    border: [true, false, true, false],
                  },
                ],
                [
                  {
                    text: `Port d'attache : ${formValue.portAttache}`,
                    fontSize: 10,
                    border: [true, false, true, true],
                  },
                  {
                    text: `Puissance : ${formValue.puissance}`,
                    fontSize: 10,
                    border: [true, false, true, true],
                  },
                ],
              ],
            },
            layout: {
              paddingLeft: () => 8,
              paddingRight: () => 8,
              paddingTop: () => 5,
              paddingBottom: () => 5,
            },
          },

          // Section Caractéristiques de l'armement
          {
            text: "CARACTÉRISTIQUES DE L'ARMEMENT",
            fontSize: 11,
            bold: true,
            alignment: "center",
            margin: [0, 15, 0, 10],
          },
          {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    text: `PROPRIÉTAIRE : ${formValue.proprietaire}`,
                    fontSize: 10,
                  },
                ],
                [{ text: `ARMATEUR : ${formValue.armateur}`, fontSize: 10 }],
              ],
            },
            layout: {
              paddingLeft: () => 8,
              paddingRight: () => 8,
              paddingTop: () => 5,
              paddingBottom: () => 5,
            },
          },

          // Section Types de pêches
          {
            text: "TYPES DE PÊCHES ET/OU ESPÈCES CIBLÉES (1) Cocher la case appropriée :",
            fontSize: 10,
            margin: [0, 15, 0, 10],
          },
          {
            table: {
              widths: ["30%", "40%", "30%"],
              body: [
                [
                  {
                    stack: [
                      this.createCheckbox(formValue.poissonsFond),
                      {
                        text: "Poissons de fond",
                        fontSize: 9,
                        margin: [18, -13, 0, 3],
                      },
                      this.createCheckbox(formValue.crustaces),
                      {
                        text: "Crustacés",
                        fontSize: 9,
                        margin: [18, -13, 0, 3],
                      },
                      this.createCheckbox(formValue.petitsPelagiques),
                      {
                        text: "Petits pélagiques",
                        fontSize: 9,
                        margin: [18, -13, 0, 3],
                      },
                      this.createCheckbox(formValue.thons),
                      { text: "Thons", fontSize: 9, margin: [18, -13, 0, 3] },
                      this.createCheckbox(formValue.autres),
                      {
                        text: "Autres (à détailler)",
                        fontSize: 9,
                        margin: [18, -13, 0, 0],
                      },
                    ],
                    border: [true, true, true, true],
                  },
                  {
                    stack: [
                      {
                        text: "Zones de pêche sous juridiction Gabonaise à l'exception d'un couloir côtier d'une largeur de douze (12) miles marins et des zones interdites à la navigation",
                        fontSize: 9,
                        italics: true,
                        margin: [0, 0, 0, 8],
                      },
                      {
                        text: "NB : La pêche est strictement interdite dans les parcs marins",
                        fontSize: 9,
                        bold: true,
                      },
                    ],
                    border: [true, true, true, true],
                  },
                  {
                    text: formValue.materiel || "",
                    fontSize: 9,
                    italics: true,
                    border: [true, true, true, true],
                  },
                ],
              ],
            },
            layout: {
              paddingLeft: () => 8,
              paddingRight: () => 8,
              paddingTop: () => 8,
              paddingBottom: () => 8,
            },
          },

          // Période de validité
          {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    text: `PÉRIODE DE VALIDITÉ :   Du ${this.formatDateFrench(formValue.dateDebut)} au ${this.formatDateFrench(formValue.dateFin)}`,
                    fontSize: 10,
                    bold: true,
                  },
                ],
              ],
            },
            margin: [0, 10, 0, 0],
            layout: {
              paddingLeft: () => 8,
              paddingRight: () => 8,
              paddingTop: () => 5,
              paddingBottom: () => 5,
            },
          },

          // Règlement des droits
          {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    text: "RÈGLEMENT DES DROITS",
                    fontSize: 10,
                    bold: true,
                    alignment: "center",
                  },
                ],
              ],
            },
            margin: [0, 10, 0, 0],
            layout: {
              paddingLeft: () => 8,
              paddingRight: () => 8,
              paddingTop: () => 5,
              paddingBottom: () => 5,
            },
          },

          // Ordre de recettes
          {
            table: {
              widths: ["70%", "30%"],
              body: [
                [
                  {
                    text: `Ordre de Recettes : ${formValue.ordreRecette}`,
                    fontSize: 10,
                  },
                  {
                    text: `Date : ${this.formatDateFrench(formValue.dateEmission)}`,
                    fontSize: 10,
                  },
                ],
              ],
            },
            layout: {
              paddingLeft: () => 8,
              paddingRight: () => 8,
              paddingTop: () => 5,
              paddingBottom: () => 5,
            },
          },

          // Signature
          {
            columns: [
              { width: "50%", text: "" },
              {
                width: "50%",
                stack: [
                  {
                    text: "Fait à Libreville, le",
                    fontSize: 10,
                    alignment: "center",
                    margin: [0, 20, 0, 5],
                  },
                  {
                    text: "",
                    fontSize: 10,
                    alignment: "center",
                    margin: [0, 0, 0, 5],
                  },
                  {
                    text: "Le Ministre",
                    fontSize: 11,
                    bold: true,
                    alignment: "center",
                    margin: [0, 0, 0, 25],
                  },
                  {
                    canvas: [
                      {
                        type: "line",
                        x1: 0,
                        y1: 0,
                        x2: 150,
                        y2: -15,
                        lineWidth: 2,
                        lineColor: "#000080",
                      },
                      {
                        type: "line",
                        x1: 0,
                        y1: -15,
                        x2: 150,
                        y2: 0,
                        lineWidth: 2,
                        lineColor: "#000080",
                      },
                    ],
                    alignment: "center",
                    margin: [0, 0, 0, 5],
                  },
                  {
                    text: formValue.ministre,
                    fontSize: 11,
                    bold: true,
                    alignment: "center",
                  },
                ],
              },
            ],
          },
        ],

        defaultStyle: {
          font: "Roboto",
        },
      };

      // Génération et téléchargement du PDF
      pdfMake
        .createPdf(docDefinition)
        .download(
          `Licence_Peche_${formValue.licenseNumber}_${formValue.year}.pdf`,
        );
    } catch (error) {
      console.error("Erreur lors de la génération du PDF:", error);
      alert("Une erreur est survenue lors de la génération du PDF");
    } finally {
      this.isGenerating = false;
    }
  }

  // Méthode pour ouvrir le PDF dans un nouvel onglet au lieu de le télécharger
  openPDF(): void {
    if (this.licenseForm.invalid) {
      alert("Veuillez remplir tous les champs obligatoires");
      return;
    }

    this.isGenerating = true;
    const formValue = this.licenseForm.value;

    try {
      const docDefinition: any = this.buildDocDefinition(formValue);
      pdfMake.createPdf(docDefinition).open();
    } catch (error) {
      console.error("Erreur lors de l'ouverture du PDF:", error);
      alert("Une erreur est survenue lors de l'ouverture du PDF");
    } finally {
      this.isGenerating = false;
    }
  }

  private buildDocDefinition(formValue: any): any {
    // Même structure que dans generatePDF
    // (Code dupliqué pour la clarté, pourrait être refactorisé)
    return {
      pageSize: "A4",
      pageMargins: [40, 60, 40, 60],
      // ... reste de la définition
    };
  }
}
