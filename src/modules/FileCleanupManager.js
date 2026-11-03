const fs = require('fs-extra');
const path = require('path');
const DatabaseService = require('../database/services/DatabaseService');

/**
 * Module responsible for cleaning up old generated files
 * Prevents disk space from filling up with old TEX and PDF files
 */
class FileCleanupManager {
  constructor() {
    this.cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.maxFileAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    this.outputDir = path.join(process.cwd(), 'output');
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.tempDir = path.join(process.cwd(), 'temp');
  }

  /**
   * Start the automatic cleanup process
   */
  startAutomaticCleanup() {
    console.log('[CLEANUP] 🧹 Starting automatic file cleanup service');
    console.log('[CLEANUP] Cleanup interval:', this.cleanupInterval / 1000 / 60 / 60, 'hours');
    console.log('[CLEANUP] Max file age:', this.maxFileAge / 1000 / 60 / 60 / 24, 'days');
    
    // Run cleanup immediately
    this.performCleanup();
    
    // Schedule regular cleanup
    setInterval(() => {
      this.performCleanup();
    }, this.cleanupInterval);
  }

  /**
   * Perform the actual cleanup process
   */
  async performCleanup() {
    try {
      console.log('[CLEANUP] 🧹 Starting file cleanup process...');
      const startTime = Date.now();
      
      let totalFilesRemoved = 0;
      let totalSizeFreed = 0;

      // Clean output directory (generated TEX and PDF files)
      const outputCleanup = await this.cleanDirectory(this.outputDir, 'output');
      totalFilesRemoved += outputCleanup.filesRemoved;
      totalSizeFreed += outputCleanup.sizeFreed;

      // Clean uploads directory (temporary uploaded files)
      const uploadsCleanup = await this.cleanDirectory(this.uploadsDir, 'uploads');
      totalFilesRemoved += uploadsCleanup.filesRemoved;
      totalSizeFreed += uploadsCleanup.sizeFreed;

      // Clean temp directory
      const tempCleanup = await this.cleanDirectory(this.tempDir, 'temp');
      totalFilesRemoved += tempCleanup.filesRemoved;
      totalSizeFreed += tempCleanup.sizeFreed;

      // Clean expired files from database records
      await this.cleanExpiredDatabaseRecords();

      const duration = Date.now() - startTime;
      console.log('[CLEANUP] ✅ Cleanup completed');
      console.log(`[CLEANUP] Files removed: ${totalFilesRemoved}`);
      console.log(`[CLEANUP] Space freed: ${this.formatBytes(totalSizeFreed)}`);
      console.log(`[CLEANUP] Duration: ${duration}ms`);

      // Record cleanup metrics
      await DatabaseService.recordSystemMetric(
        'cleanup_completed',
        totalFilesRemoved,
        'files',
        {
          sizeFreedBytes: totalSizeFreed,
          durationMs: duration,
          timestamp: new Date().toISOString()
        }
      );

    } catch (error) {
      console.error('[CLEANUP] ❌ Error during cleanup:', error);
      
      // Record cleanup error
      await DatabaseService.recordSystemMetric(
        'cleanup_failed',
        1,
        'count',
        {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      );
    }
  }

  /**
   * Clean a specific directory
   * @param {string} dirPath - Directory path to clean
   * @param {string} dirName - Directory name for logging
   * @returns {Object} - Cleanup results
   */
  async cleanDirectory(dirPath, dirName) {
    const results = {
      filesRemoved: 0,
      sizeFreed: 0
    };

    try {
      if (!await fs.pathExists(dirPath)) {
        console.log(`[CLEANUP] Directory ${dirName} does not exist, skipping`);
        return results;
      }

      const files = await fs.readdir(dirPath);
      const cutoffTime = Date.now() - this.maxFileAge;

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        
        try {
          const stats = await fs.stat(filePath);
          
          // Skip directories
          if (stats.isDirectory()) {
            continue;
          }

          // Check if file is old enough to be cleaned
          if (stats.mtime.getTime() < cutoffTime) {
            console.log(`[CLEANUP] Removing old file: ${file} (age: ${Math.round((Date.now() - stats.mtime.getTime()) / 1000 / 60 / 60 / 24)} days)`);
            
            results.sizeFreed += stats.size;
            await fs.remove(filePath);
            results.filesRemoved++;
          }
        } catch (fileError) {
          console.warn(`[CLEANUP] ⚠️ Error processing file ${file}:`, fileError.message);
        }
      }

      if (results.filesRemoved > 0) {
        console.log(`[CLEANUP] ${dirName}: removed ${results.filesRemoved} files, freed ${this.formatBytes(results.sizeFreed)}`);
      } else {
        console.log(`[CLEANUP] ${dirName}: no files to clean`);
      }

    } catch (error) {
      console.error(`[CLEANUP] ❌ Error cleaning ${dirName} directory:`, error);
    }

    return results;
  }

  /**
   * Clean expired database records
   */
  async cleanExpiredDatabaseRecords() {
    try {
      console.log('[CLEANUP] 🗄️ Cleaning expired database records...');
      
      // This would typically involve removing old file records that no longer exist
      // or updating database to reflect cleaned files
      // Implementation depends on your specific database setup
      
      console.log('[CLEANUP] ✅ Database cleanup completed');
    } catch (error) {
      console.error('[CLEANUP] ❌ Error cleaning database records:', error);
    }
  }

  /**
   * Clean files older than specified age
   * @param {number} maxAge - Maximum age in milliseconds
   */
  async cleanOlderThan(maxAge) {
    const originalMaxAge = this.maxFileAge;
    this.maxFileAge = maxAge;
    
    try {
      await this.performCleanup();
    } finally {
      this.maxFileAge = originalMaxAge;
    }
  }

  /**
   * Clean specific file types
   * @param {Array} extensions - File extensions to clean (e.g., ['.tex', '.pdf'])
   */
  async cleanFileTypes(extensions) {
    try {
      console.log(`[CLEANUP] 🧹 Cleaning specific file types: ${extensions.join(', ')}`);
      
      const directories = [this.outputDir, this.uploadsDir, this.tempDir];
      let totalRemoved = 0;
      
      for (const dirPath of directories) {
        if (!await fs.pathExists(dirPath)) continue;
        
        const files = await fs.readdir(dirPath);
        
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const ext = path.extname(file).toLowerCase();
          
          if (extensions.includes(ext)) {
            try {
              const stats = await fs.stat(filePath);
              if (stats.isFile()) {
                await fs.remove(filePath);
                totalRemoved++;
                console.log(`[CLEANUP] Removed: ${file}`);
              }
            } catch (error) {
              console.warn(`[CLEANUP] ⚠️ Error removing ${file}:`, error.message);
            }
          }
        }
      }
      
      console.log(`[CLEANUP] ✅ Cleaned ${totalRemoved} files of types: ${extensions.join(', ')}`);
      return totalRemoved;
      
    } catch (error) {
      console.error('[CLEANUP] ❌ Error cleaning file types:', error);
      return 0;
    }
  }

  /**
   * Get cleanup statistics
   * @returns {Object} - Statistics about files and disk usage
   */
  async getCleanupStats() {
    const stats = {
      output: await this.getDirectoryStats(this.outputDir),
      uploads: await this.getDirectoryStats(this.uploadsDir),
      temp: await this.getDirectoryStats(this.tempDir)
    };

    stats.total = {
      files: stats.output.files + stats.uploads.files + stats.temp.files,
      size: stats.output.size + stats.uploads.size + stats.temp.size,
      oldFiles: stats.output.oldFiles + stats.uploads.oldFiles + stats.temp.oldFiles,
      oldSize: stats.output.oldSize + stats.uploads.oldSize + stats.temp.oldSize
    };

    return stats;
  }

  /**
   * Get statistics for a specific directory
   * @param {string} dirPath - Directory path
   * @returns {Object} - Directory statistics
   */
  async getDirectoryStats(dirPath) {
    const stats = {
      files: 0,
      size: 0,
      oldFiles: 0,
      oldSize: 0
    };

    try {
      if (!await fs.pathExists(dirPath)) {
        return stats;
      }

      const files = await fs.readdir(dirPath);
      const cutoffTime = Date.now() - this.maxFileAge;

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        
        try {
          const fileStats = await fs.stat(filePath);
          
          if (fileStats.isFile()) {
            stats.files++;
            stats.size += fileStats.size;
            
            if (fileStats.mtime.getTime() < cutoffTime) {
              stats.oldFiles++;
              stats.oldSize += fileStats.size;
            }
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    } catch (error) {
      console.warn(`[CLEANUP] ⚠️ Error getting stats for ${dirPath}:`, error.message);
    }

    return stats;
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Bytes to format
   * @returns {string} - Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Stop the automatic cleanup process
   */
  stopAutomaticCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      console.log('[CLEANUP] 🛑 Automatic cleanup stopped');
    }
  }
}

module.exports = FileCleanupManager; 