import { PartialType } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto.js';

/** Mise à jour partielle : seuls les champs envoyés changent ; `null` efface un champ facultatif. */
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
