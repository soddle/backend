import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import * as multer from 'multer';
import * as path from 'path';

@Injectable()
export class FileSSEInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    // Set as an SSE request
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Connection', 'keep-alive');
    // res.flushHeaders();
    // return next.handle();

    // If it's not an SSE request, handle file upload
    const upload = multer({
      storage: multer.memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() === '.wav') {
          cb(null, true);
        } else {
          cb(null, false);
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB limit
      },
    }).single('file');

    return new Observable((observer) => {
      upload(req, res, (err) => {
        if (err) {
          observer.error(err);
        } else {
          next.handle().subscribe(observer);
        }
      });
    });
  }
}
