import {SourceMusicPart} from "./SourceMusicPart";
import {VoiceEntry} from "../VoiceData/VoiceEntry";
import {SourceStaffEntry} from "../VoiceData/SourceStaffEntry";
import {SourceMeasure} from "../VoiceData/SourceMeasure";
import {Fraction} from "../../Common/DataObjects/fraction";
import {MusicSheet} from "../MusicSheet";
import {RepetitionInstruction} from "../VoiceData/Instructions/RepetitionInstruction";
import {PartListEntry} from "./PartListEntry";

export class Repetition extends PartListEntry /*implements IRepetition*/ {
    constructor(musicSheet: MusicSheet, virtualOverallRepetition: boolean) {
        super(musicSheet);
        this.musicSheet = musicSheet;
        this.virtualOverallRepetition = virtualOverallRepetition;
    }

    public StartMarker: RepetitionInstruction;
    public EndMarker: RepetitionInstruction;
    public ForwardJumpInstruction: RepetitionInstruction;

    private backwardJumpInstructions: RepetitionInstruction[] = new Array();
    private endingParts: RepetitionEndingPart[] = new Array();
    private endingIndexDict: { [_: number] : RepetitionEndingPart; } = {};
    private userNumberOfRepetitions: number = 0;
    private visibles: boolean[] = new Array();
    private fromWords: boolean = false;
    private musicSheet: MusicSheet;
    private repetitonIterationOrder: number[] = new Array();
    private numberOfEndings: number = 1;
    private virtualOverallRepetition: boolean;

    public get BackwardJumpInstructions(): RepetitionInstruction[] {
        return this.backwardJumpInstructions;
    }
    public get EndingIndexDict(): { [_: number] : RepetitionEndingPart; } {
        return this.endingIndexDict;
    }
    public get EndingParts(): RepetitionEndingPart[] {
        return this.endingParts;
    }
    public get Visibles(): boolean[] {
        return this.visibles;
    }
    public set Visibles(value: boolean[]) {
        this.visibles = value;
    }
    public get DefaultNumberOfRepetitions(): number {
        let defaultNumber: number = 2;
        if (this.virtualOverallRepetition) { defaultNumber = 1; }
        return Math.Max(Math.Max(defaultNumber, this.endingIndexDict.length), this.checkRepetitionForMultipleLyricVerses());
    }
    public get UserNumberOfRepetitions(): number {
        return this.userNumberOfRepetitions;
    }
    public set UserNumberOfRepetitions(value: number) {
        this.userNumberOfRepetitions = value;
        this.repetitonIterationOrder = [];
        let endingsDiff: number = this.userNumberOfRepetitions - this.NumberOfEndings;
        for (let i: number = 1; i <= this.userNumberOfRepetitions; i++) {
            if (i <= endingsDiff) {
                this.repetitonIterationOrder.push(1);
            } else {
                this.repetitonIterationOrder.push(i - endingsDiff);
            }
        }
    }
    public getForwardJumpTargetForIteration(iteration: number): number {
        let endingIndex: number = this.repetitonIterationOrder[iteration - 1];
        if (this.endingIndexDict[endingIndex] !== undefined) {
            return this.endingIndexDict[endingIndex].part.StartIndex;
        }
        return -1;
    }
    public getBackwardJumpTarget(): number {
        return this.StartMarker.MeasureIndex;
    }
    public SetEndingStartIndex(endingNumbers: number[], startIndex: number): void {
        let part: RepetitionEndingPart = new RepetitionEndingPart(new SourceMusicPart(this.musicSheet, startIndex, startIndex));
        this.endingParts.push(part);
        for (let idx: number = 0, len: number = endingNumbers.length; idx < len; ++idx) {
            let endingNumber: number = endingNumbers[idx];
            try {
                this.endingIndexDict[endingNumber] = part;
                part.endingIndices.push(endingNumber);
                if (this.numberOfEndings < endingNumber) {
                    this.numberOfEndings = endingNumber;
                }
            } catch (err) {
                console.log("Repetition: Exception."); // FIXME
            }

        }
    }
    public SetEndingStartIndex(endingNumber: number, startIndex: number): void {
        let part: RepetitionEndingPart = new RepetitionEndingPart(new SourceMusicPart(this.musicSheet, startIndex, startIndex));
        this.endingParts.push(part);
        this.endingIndexDict[endingNumber] = part;
        part.endingIndices.push(endingNumber);
        if (this.numberOfEndings < endingNumber) {
            this.numberOfEndings = endingNumber;
        }
    }
    public setEndingEndIndex(endingNumber: number, endIndex: number): void {
        if (this.endingIndexDict[endingNumber] !== undefined) {
            this.endingIndexDict[endingNumber].part.setEndIndex(endIndex);
        }
    }
    public get NumberOfEndings(): number {
        return this.numberOfEndings;
    }
    public get FromWords(): boolean {
        return this.fromWords;
    }
    public set FromWords(value: boolean) {
        this.fromWords = value;
    }
    public get AbsoluteTimestamp(): Fraction {
        return new Fraction(this.musicSheet.SourceMeasures[this.StartMarker.MeasureIndex].AbsoluteTimestamp);
    }
    public get StartIndex(): number {
        return this.StartMarker.MeasureIndex;
    }
    public get EndIndex(): number {
        if (this.BackwardJumpInstructions.length === 0) {
            return this.StartIndex;
        }
        let result: number = this.backwardJumpInstructions[this.backwardJumpInstructions.length - 1].MeasureIndex;
        if (this.endingIndexDict[this.NumberOfEndings] !== undefined) {
            result = Math.max(this.endingIndexDict[this.NumberOfEndings].part.EndIndex, result);
        }
        return result;
    }
    private checkRepetitionForMultipleLyricVerses(): number {
        let lyricVerses: number = 0;
        let start: number = this.StartIndex;
        let end: number = this.EndIndex;
        for (let measureIndex: number = start; measureIndex <= end; measureIndex++) {
            let sourceMeasure: SourceMeasure = this.musicSheet.SourceMeasures[measureIndex];
            for (let i: number = 0; i < sourceMeasure.CompleteNumberOfStaves; i++) {
                for (let j: number = 0; j < sourceMeasure.VerticalSourceStaffEntryContainers.length; j++) {
                    if (sourceMeasure.VerticalSourceStaffEntryContainers[j][i] !== undefined) {
                        let sourceStaffEntry: SourceStaffEntry = sourceMeasure.VerticalSourceStaffEntryContainers[j][i];
                        let verses: number = 0;
                        for (let idx: number = 0, len: number = sourceStaffEntry.VoiceEntries.length; idx < len; ++idx) {
                            let voiceEntry: VoiceEntry = sourceStaffEntry.VoiceEntries[idx];
                            verses += voiceEntry.LyricsEntries.length;
                        }
                        lyricVerses = Math.max(lyricVerses, verses);
                    }
                }
            }
        }
        return lyricVerses;
    }
    public get FirstSourceMeasureNumber(): number {
        return this.getFirstSourceMeasure().MeasureNumber;
    }
    public get LastSourceMeasureNumber(): number {
        return this.getLastSourceMeasure().MeasureNumber;
    }

}

export class RepetitionEndingPart {
    constructor(endingPart: SourceMusicPart) {
        this.part = endingPart;
    }
    public part: SourceMusicPart;
    public endingIndices: number[] = new Array();
    public ToString(): string {
      return this.endingIndices.join(", ");
    }
}
