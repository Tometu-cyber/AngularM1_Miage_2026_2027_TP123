import { Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Track } from '../../shared/models/track.model';
import { formatLabel, formatSize } from '../../shared/utils/audio-file';

/** Card d'une piste : métadonnées et action de lecture. */
@Component({
  selector: 'app-track-card',
  imports: [DatePipe],
  templateUrl: './track-card.html',
  styleUrl: './track-card.css',
})
export class TrackCardComponent {
  readonly track = input.required<Track>();
  readonly playing = input(false);
  readonly busy = input(false);
  readonly play = output<Track>();

  readonly size = computed(() => formatSize(this.track().size));
  readonly format = computed(() => formatLabel(this.track().mimeType));
}
